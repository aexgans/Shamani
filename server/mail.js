// Письма. В прототипе не отправляются, а кладутся HTML-файлами в .dev-mail/ —
// в бою здесь будет вызов сервиса рассылок (Resend / Unisender) со своего домена.
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', '.dev-mail');

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function layout(title, body, button) {
  return '<div style="background:#0C0B12;padding:32px 16px;font-family:Georgia,\'Times New Roman\',serif">' +
    '<div style="max-width:520px;margin:0 auto;background:#13111B;border:1px solid #2C283B;border-radius:18px;padding:32px 28px;color:#EDE4CF">' +
    '<p style="margin:0 0 6px;font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#8E88C8">Шамани</p>' +
    `<h1 style="margin:0 0 14px;font-weight:400;font-size:30px;line-height:1.1">${esc(title)}</h1>` +
    `<div style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#A29AAE">${body}</div>` +
    `<a href="${esc(button.href)}" style="display:inline-block;background:#F0A84A;color:#1E1407;text-decoration:none;padding:13px 26px;border-radius:999px;font-size:16px">${esc(button.label)}</a>` +
    '<p style="margin:28px 0 0;font-size:13px;color:#6C6579">Письмо пришло, потому что этот адрес указали при заявке на сайте Шамани.</p>' +
    '</div></div>';
}

function send(to, subject, html) {
  fs.mkdirSync(OUT, { recursive: true });
  const file = path.join(OUT, `${Date.now()}-${to.replace(/[^\w.@-]/g, '_')}.html`);
  fs.writeFileSync(file, `<!doctype html><meta charset="utf-8"><title>${esc(subject)}</title>` +
    `<p style="font:14px sans-serif">Кому: ${esc(to)} · Тема: ${esc(subject)}</p>${html}`);
  console.log(`[письмо] ${to}: «${subject}» → ${path.relative(path.join(__dirname, '..'), file)}`);
}

function orderAccepted(o, link) {
  send(o.email, `Заявка ${o.number} принята · Шамани`, layout(
    `Заявка ${o.number}`,
    'Мы получили твои ответы. Как только мантра и видео будут готовы, пришлём ещё одно письмо.<br>' +
    `Статус заявки можно посмотреть в любой момент по ссылке или по номеру <b style="color:#EDE4CF">${esc(o.number)}</b> на сайте.`,
    { href: link, label: 'Статус заявки' }));
}

function orderReady(o, link) {
  const until = new Date(o.accessUntil).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  send(o.email, 'Твоя мантра готова · Шамани', layout(
    'Твоя мантра готова',
    `Видео и текст мантры ждут на твоей странице. Доступ открыт до <b style="color:#EDE4CF">${until}</b> — ` +
    'скачай файлы, чтобы они остались с тобой и после.',
    { href: link, label: 'Открыть мантру' }));
}

module.exports = { orderAccepted, orderReady };
