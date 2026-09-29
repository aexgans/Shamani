// Заглушка нейросети: ведёт себя так же, как будет вести себя настоящая, — через API из docs/generator-api.md.
// Запуск рядом с сервером:  node tools/fake-generator.js
// Настройки: SITE (адрес сайта), GENERATOR_KEY, GEN_SECONDS (сколько «генерировать», по умолчанию 20).
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SITE = (process.env.SITE || 'http://localhost:5173').replace(/\/$/, '');
const KEY = process.env.GENERATOR_KEY || 'dev-generator-key';
const GEN_SECONDS = +(process.env.GEN_SECONDS || 20);
const root = path.join(__dirname, '..');
const auth = { Authorization: `Bearer ${KEY}` };

// Текст мантры собираем старым генератором сайта — чтобы по ответам анкеты получалось правдоподобно
const ctx = {};
vm.runInNewContext(fs.readFileSync(path.join(root, 'js', 'mantra.js'), 'utf8') + '\nthis.Mantra = Mantra;', ctx);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(method, url, body, headers = {}) {
  const res = await fetch(SITE + url, { method, headers: { ...auth, ...headers }, body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(`${method} ${url} → ${res.status} ${JSON.stringify(data)}`);
  return data;
}

// «Музыка»: 20 секунд тихого аккорда с дыханием громкости — WAV, 16 кГц, моно
function music(seconds = 20, rate = 16000) {
  const n = seconds * rate;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const breath = 0.55 + 0.45 * Math.sin(2 * Math.PI * t / 8);
    const fade = Math.min(1, t / 2, (seconds - t) / 2);
    const v = (Math.sin(2 * Math.PI * 196 * t) + 0.5 * Math.sin(2 * Math.PI * 294 * t) + 0.3 * Math.sin(2 * Math.PI * 392 * t)) / 1.8;
    buf.writeInt16LE(Math.round(v * breath * fade * 9000), 44 + i * 2);
  }
  return buf;
}

async function work(job) {
  console.log(`[генератор] взял ${job.id}, ответы:`, job.answers);
  await sleep(GEN_SECONDS * 1000);

  const a = job.answers;
  const m = ctx.Mantra.build({
    sphere: a.sphere in ctx.Mantra.SPHERES ? a.sphere : 'calm',
    release: a.release in ctx.Mantra.RELEASE ? a.release : 'anxiety',
    call: a.call in ctx.Mantra.CALL ? a.call : 'clarity',
    element: a.element in ctx.Mantra.ELEMENTS ? a.element : 'water',
    time: a.time in ctx.Mantra.TIMES ? a.time : 'night',
    name: a.name, intention: a.intention,
  });

  const put = (name, data, type) => call('PUT', `/api/generator/jobs/${job.id}/files/${name}`, data, { 'Content-Type': type });
  await put('video.mp4', fs.readFileSync(path.join(root, 'media', 'test-video.mp4')), 'video/mp4');
  await put('poster.jpg', fs.readFileSync(path.join(root, 'media', 'test-poster.jpg')), 'image/jpeg');
  await put('music.wav', music(), 'audio/wav');
  await call('POST', `/api/generator/jobs/${job.id}/done`, JSON.stringify({
    title: m.name ? `Мантра для тебя, ${m.name}` : 'Твоя мантра',
    lines: m.lines,
    note: m.note,
  }), { 'Content-Type': 'application/json' });
  console.log(`[генератор] ${job.id} готово`);
}

(async () => {
  console.log(`[генератор] слушаю ${SITE}, генерация ${GEN_SECONDS} с`);
  for (;;) {
    try {
      const { job } = await call('POST', '/api/generator/next');
      if (job) {
        try { await work(job); } catch (err) {
          console.error(`[генератор] ${job.id} не вышло:`, err.message);
          await call('POST', `/api/generator/jobs/${job.id}/fail`).catch(() => {});
        }
        continue;
      }
    } catch (err) {
      console.error('[генератор]', err.message);
    }
    await sleep(3000);
  }
})();
