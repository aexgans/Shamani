// Локальный просмотр сайта: node serve.js → http://localhost:5173
// POST /api/subscribe — заглушка отправки писем: письмо сохраняется в .dev-mail/ вместо отправки.
const http = require('http');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = __dirname;
const port = process.env.PORT || 5173;
const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.ico': 'image/x-icon', '.json': 'application/json',
  '.mp4': 'video/mp4', '.webm': 'video/webm',
};

http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api/subscribe') return subscribe(req, res);

  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(root, urlPath === '/' ? 'index.html' : urlPath);
  if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) { res.writeHead(404); return res.end('Not found'); }
    const type = types[path.extname(file)] || 'application/octet-stream';
    // Range нужен браузеру, чтобы перематывать видео
    const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
    if (range) {
      const start = range[1] ? +range[1] : stat.size - +range[2];
      const end = range[1] && range[2] ? Math.min(+range[2], stat.size - 1) : stat.size - 1;
      res.writeHead(206, { 'Content-Type': type, 'Accept-Ranges': 'bytes',
        'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Content-Length': end - start + 1 });
      return fs.createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(200, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': stat.size });
    fs.createReadStream(file).pipe(res);
  });
}).listen(port, () => console.log(`Шамани: http://localhost:${port}`));

function subscribe(req, res) {
  let body = '';
  req.on('data', (c) => { body += c; if (body.length > 1e5) req.destroy(); });
  req.on('end', () => {
    const send = (code, obj) => {
      res.writeHead(code, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(obj));
    };
    let data;
    try { data = JSON.parse(body); } catch (e) { return send(400, { ok: false, error: 'bad-json' }); }

    // Берём шаблон письма прямо из backend/Code.gs — локально видно то же, что уйдёт на почту
    const gs = {};
    vm.runInNewContext(fs.readFileSync(path.join(root, 'backend', 'Code.gs'), 'utf8'), gs);
    const email = String(data.email || '').trim().toLowerCase();
    if (data.website) return send(200, { ok: true });
    if (!gs.isEmail(email)) return send(200, { ok: false, error: 'bad-email' });

    const links = gs.buildLinks(data.mantra, `http://localhost:${port}/`);
    const dir = path.join(root, '.dev-mail');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${Date.now()}-${email.replace(/[^\w.@-]/g, '_')}.html`);
    fs.writeFileSync(file, `<!doctype html><meta charset="utf-8"><title>${gs.SUBJECT}</title>` +
      `<p style="font:14px sans-serif">Кому: ${email.replace(/[<>&"]/g, "")}</p>${gs.letterHtml(links)}`);
    console.log(`[письмо] ${email} → ${path.relative(root, file)}`);
    send(200, { ok: true });
  });
}
