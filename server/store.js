// Заявки прототипа: один JSON-файл + папка с файлами на каждую заявку.
// В бою это заменят база (Cloudflare D1) и хранилище файлов (R2) — интерфейс модуля останется тем же.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA = path.join(__dirname, '..', 'data');
const DB = path.join(DATA, 'orders.json');
const FILES = path.join(DATA, 'files');
fs.mkdirSync(FILES, { recursive: true });

let orders = {};
try { orders = JSON.parse(fs.readFileSync(DB, 'utf8')); } catch (e) { orders = {}; }

function save() {
  fs.writeFileSync(DB + '.tmp', JSON.stringify(orders, null, 2));
  fs.renameSync(DB + '.tmp', DB);
}

// Номер — чтобы человек мог назвать заявку; токен — длинный секрет, он и есть доступ к странице
function newNumber() {
  let n;
  do { n = 'SH-' + crypto.randomInt(100000, 1000000); } while (Object.values(orders).some((o) => o.number === n));
  return n;
}

function create({ email, answers }) {
  const token = crypto.randomBytes(18).toString('base64url');
  const o = {
    token, number: newNumber(), email, answers,
    status: 'awaiting_payment', // → queued → generating → ready → expired
    createdAt: Date.now(), paidAt: null, startedAt: null, readyAt: null, accessUntil: null,
    result: null, files: [],
  };
  orders[token] = o;
  save();
  return o;
}

const byToken = (t) => (typeof t === 'string' && orders[t]) || null;
const byNumber = (n) => Object.values(orders).find((o) => o.number === n) || null;

function update(o, patch) { Object.assign(o, patch); save(); return o; }

// Самая старая оплаченная заявка, которую никто не делает (или взял и пропал дольше stuckMs)
function nextQueued(stuckMs) {
  const now = Date.now();
  return Object.values(orders)
    .filter((o) => o.status === 'queued' || (o.status === 'generating' && now - o.startedAt > stuckMs))
    .sort((a, b) => a.paidAt - b.paidAt)[0] || null;
}

const dir = (o) => path.join(FILES, o.token);

function expireIfDue(o) {
  if (o.status === 'ready' && o.accessUntil <= Date.now()) {
    fs.rmSync(dir(o), { recursive: true, force: true });
    update(o, { status: 'expired', files: [] });
  }
  return o;
}

function sweep() { Object.values(orders).forEach(expireIfDue); }

module.exports = { create, byToken, byNumber, update, nextQueued, dir, expireIfDue, sweep };
