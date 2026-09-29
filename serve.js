// Локальный просмотр сайта: node serve.js → http://localhost:5173
// /api/… — прототип заявок (server/api.js). Письма не отправляются, а падают в .dev-mail/.
const http = require('http');
const fs = require('fs');
const path = require('path');
const api = require('./server/api');

const root = __dirname;
const port = process.env.PORT || 5173;
const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.ico': 'image/x-icon', '.json': 'application/json',
  '.mp4': 'video/mp4', '.webm': 'video/webm',
};
// Заявки с почтами и серверный код наружу не отдаём
const PRIVATE = /^\/(data|server|tools|\.git|\.claude)(\/|$)/i;

http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) return api.handle(req, res);

  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(root, urlPath === '/' ? 'index.html' : urlPath);
  const rel = '/' + path.relative(root, file).split(path.sep).join('/');
  if (!file.startsWith(root) || PRIVATE.test(rel)) { res.writeHead(403); return res.end(); }
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
