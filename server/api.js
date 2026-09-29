// API прототипа. Три группы адресов:
//  /api/orders/…     — сайт: создать заявку, узнать статус, найти по номеру, (тестовая) оплата
//  /api/generator/…  — нейросеть: взять заявку, загрузить файлы, отметить готовность (по ключу)
//  /api/media/…      — файлы заявки; отдаются, только пока открыт доступ
// Описание для разработчика нейросети — docs/generator-api.md
const fs = require('fs');
const path = require('path');
const store = require('./store');
const mail = require('./mail');

const ACCESS_DAYS = 14;
const GENERATOR_KEY = process.env.GENERATOR_KEY || 'dev-generator-key';
const STUCK_MS = 30 * 60 * 1000; // взятая, но не сданная за 30 минут заявка возвращается в очередь
const DEV = process.env.NODE_ENV !== 'production';

const FILE_NAME = /^[\w-]{1,60}\.(mp4|webm|mp3|m4a|wav|ogg|jpg|png|pdf|txt)$/;
const TYPES = {
  mp4: 'video/mp4', webm: 'video/webm', mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', ogg: 'audio/ogg',
  jpg: 'image/jpeg', png: 'image/png', pdf: 'application/pdf', txt: 'text/plain; charset=utf-8',
};
const isEmail = (s) => typeof s === 'string' && s.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

function readJson(req, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > limit) { reject(new Error('too-big')); req.destroy(); } });
    req.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch (e) { reject(e); } });
  });
}

const origin = (req) => `http://${req.headers.host}`;
const pageLink = (req, o) => `${origin(req)}/order.html?t=${o.token}`;

// То, что видит человек на своей странице: без почты и без ответов анкеты
function publicView(o) {
  store.expireIfDue(o);
  const v = { number: o.number, status: o.status, createdAt: o.createdAt, accessUntil: o.accessUntil };
  if (o.status === 'ready') {
    v.result = o.result;
    v.files = o.files.map((f) => ({ name: f.name, size: f.size, kind: f.name.split('.').pop() }));
  }
  return v;
}

async function handle(req, res) {
  const url = new URL(req.url, 'http://x');
  const parts = url.pathname.split('/').filter(Boolean).slice(1); // без «api»
  const [group, a, b, c, d] = parts;
  try {
    if (group === 'orders') return await orders(req, res, a, b);
    if (group === 'generator') return await generator(req, res, a, b, c, d);
    if (group === 'media') return media(req, res, url, a, b);
    if (group === 'dev' && DEV) return await dev(req, res, a, b, c);
    json(res, 404, { ok: false, error: 'not-found' });
  } catch (err) {
    console.error(err);
    json(res, 400, { ok: false, error: 'bad-request' });
  }
}

async function orders(req, res, a, b) {
  // POST /api/orders — новая заявка из анкеты
  if (req.method === 'POST' && !a) {
    const data = await readJson(req);
    if (data.website) return json(res, 200, { ok: true }); // ловушка для ботов
    const email = String(data.email || '').trim().toLowerCase();
    if (!isEmail(email)) return json(res, 422, { ok: false, error: 'bad-email' });
    const answers = data.answers && typeof data.answers === 'object' ? data.answers : {};
    const clean = {};
    for (const [k, v] of Object.entries(answers)) if (/^\w{1,20}$/.test(k)) clean[k] = String(v).slice(0, 240);
    const o = store.create({ email, answers: clean });
    mail.orderAccepted(o, pageLink(req, o));
    return json(res, 200, { ok: true, token: o.token, number: o.number });
  }
  // POST /api/orders/lookup — найти заявку по номеру и почте (номер один — слишком легко подобрать)
  if (req.method === 'POST' && a === 'lookup') {
    const data = await readJson(req);
    const o = store.byNumber(String(data.number || '').trim().toUpperCase());
    if (!o || o.email !== String(data.email || '').trim().toLowerCase()) return json(res, 404, { ok: false, error: 'not-found' });
    return json(res, 200, { ok: true, token: o.token });
  }
  const o = store.byToken(a);
  if (!o) return json(res, 404, { ok: false, error: 'not-found' });
  // GET /api/orders/<токен> — статус для страницы заявки
  if (req.method === 'GET' && !b) return json(res, 200, { ok: true, order: publicView(o) });
  // POST /api/orders/<токен>/pay — ЗАГЛУШКА оплаты. В бою статус меняет вебхук платёжного сервиса.
  if (req.method === 'POST' && b === 'pay' && DEV) {
    if (o.status === 'awaiting_payment') store.update(o, { status: 'queued', paidAt: Date.now() });
    return json(res, 200, { ok: true, order: publicView(o) });
  }
  json(res, 404, { ok: false, error: 'not-found' });
}

async function generator(req, res, a, b, c, d) {
  if (req.headers.authorization !== `Bearer ${GENERATOR_KEY}`) return json(res, 401, { ok: false, error: 'unauthorized' });

  // POST /api/generator/next — взять следующую оплаченную заявку в работу
  if (req.method === 'POST' && a === 'next') {
    const o = store.nextQueued(STUCK_MS);
    if (!o) return json(res, 200, { ok: true, job: null });
    store.update(o, { status: 'generating', startedAt: Date.now() });
    return json(res, 200, { ok: true, job: { id: o.number, answers: o.answers } });
  }

  const o = a === 'jobs' ? store.byNumber(b) : null;
  if (!o) return json(res, 404, { ok: false, error: 'not-found' });
  if (o.status !== 'generating') return json(res, 409, { ok: false, error: 'not-in-progress', status: o.status });

  // PUT /api/generator/jobs/<номер>/files/<имя> — загрузить файл (тело запроса — сам файл)
  if (req.method === 'PUT' && c === 'files') {
    if (!FILE_NAME.test(d || '')) return json(res, 422, { ok: false, error: 'bad-file-name' });
    fs.mkdirSync(store.dir(o), { recursive: true });
    const file = path.join(store.dir(o), d);
    await new Promise((resolve, reject) => {
      const out = fs.createWriteStream(file);
      req.pipe(out).on('finish', resolve).on('error', reject);
      req.on('error', reject);
    });
    const size = fs.statSync(file).size;
    store.update(o, { files: [...o.files.filter((f) => f.name !== d), { name: d, size }] });
    return json(res, 200, { ok: true, name: d, size });
  }

  // POST /api/generator/jobs/<номер>/done — всё загружено: открыть доступ и отправить письмо
  if (req.method === 'POST' && c === 'done') {
    const data = await readJson(req);
    const lines = Array.isArray(data.lines) ? data.lines.map((l) => String(l).slice(0, 300)).slice(0, 30) : [];
    if (!lines.length) return json(res, 422, { ok: false, error: 'no-lines' });
    const now = Date.now();
    store.update(o, {
      status: 'ready', readyAt: now, accessUntil: now + ACCESS_DAYS * 86400000,
      result: { title: String(data.title || 'Твоя мантра').slice(0, 120), lines, note: String(data.note || '').slice(0, 500) },
    });
    mail.orderReady(o, pageLink(req, o));
    return json(res, 200, { ok: true });
  }

  // POST /api/generator/jobs/<номер>/fail — не получилось: вернуть в очередь
  if (req.method === 'POST' && c === 'fail') {
    store.update(o, { status: 'queued', startedAt: null });
    return json(res, 200, { ok: true });
  }
  json(res, 404, { ok: false, error: 'not-found' });
}

// GET /api/media/<токен>/<файл>[?download=1] — файлы, пока открыт доступ
function media(req, res, url, token, name) {
  const o = store.byToken(token);
  if (!o) return json(res, 404, { ok: false, error: 'not-found' });
  store.expireIfDue(o);
  if (o.status !== 'ready') return json(res, 410, { ok: false, error: 'expired' });
  const download = url.searchParams.has('download');

  // Текст мантры отдаём файлом, даже если нейросеть прислала его только в /done
  if (name === 'mantra.txt' && !o.files.some((f) => f.name === name)) {
    const r = o.result;
    const text = [r.title, '', ...r.lines, '', r.note].join('\r\n').trim() + '\r\n';
    res.writeHead(200, { 'Content-Type': TYPES.txt, ...disposition(download, `mantra-${o.number}.txt`) });
    return res.end('﻿' + text);
  }

  const f = o.files.find((x) => x.name === name);
  if (!f) return json(res, 404, { ok: false, error: 'not-found' });
  const file = path.join(store.dir(o), f.name);
  const type = TYPES[f.name.split('.').pop()];
  const saveAs = `shamani-${o.number}-${f.name}`;
  const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
  if (range) {
    const start = range[1] ? +range[1] : f.size - +range[2];
    const end = range[1] && range[2] ? Math.min(+range[2], f.size - 1) : f.size - 1;
    res.writeHead(206, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${start}-${end}/${f.size}`,
      'Content-Length': end - start + 1, ...disposition(download, saveAs) });
    return fs.createReadStream(file, { start, end }).pipe(res);
  }
  res.writeHead(200, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': f.size, ...disposition(download, saveAs) });
  fs.createReadStream(file).pipe(res);
}

function disposition(download, name) {
  return download ? { 'Content-Disposition': `attachment; filename="${name}"` } : {};
}

// Только локально: «промотать время», чтобы проверить окончание доступа
async function dev(req, res, a, token, action) {
  const o = a === 'orders' ? store.byToken(token) : null;
  if (req.method !== 'POST' || !o || action !== 'expire') return json(res, 404, { ok: false, error: 'not-found' });
  if (o.status === 'ready') store.update(o, { accessUntil: Date.now() - 1000 });
  return json(res, 200, { ok: true, order: publicView(o) });
}

setInterval(store.sweep, 60 * 60 * 1000).unref();

module.exports = { handle };
