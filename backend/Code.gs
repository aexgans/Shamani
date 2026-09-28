/* Шамани — отправка писем со ссылкой на видео.
   Google Apps Script, привязанный к Google-таблице. Установка — backend/README.md.
   Этот же файл читает serve.js, чтобы локально показывать то же письмо. */

var SITE_URL = 'https://aexgans.github.io/Shamani/'; // адрес опубликованного сайта, со слешем в конце
var SUBJECT = 'Твоё видео · Шамани';
var REPEAT_MINUTES = 10; // не слать повторно на тот же адрес чаще

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents || '{}');
    var email = String(data.email || '').trim().toLowerCase();
    if (data.website) return reply({ ok: true }); // бот заполнил ловушку — молча игнорируем
    if (!isEmail(email)) return reply({ ok: false, error: 'bad-email' });

    var cache = CacheService.getScriptCache();
    if (cache.get('sent:' + email)) return reply({ ok: true, repeat: true });

    var links = buildLinks(data.mantra);
    MailApp.sendEmail({
      to: email,
      subject: SUBJECT,
      htmlBody: letterHtml(links),
      body: letterText(links),
      name: 'Шамани',
    });
    cache.put('sent:' + email, '1', REPEAT_MINUTES * 60);

    SpreadsheetApp.getActiveSpreadsheet().getSheets()[0]
      .appendRow([new Date(), email, links.mantra ? 'да' : '']);
    return reply({ ok: true });
  } catch (err) {
    console.error(err);
    return reply({ ok: false, error: 'server' });
  }
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function isEmail(s) {
  return s.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
}

// Ссылки собираем сами: от сайта принимаем только код мантры (base64url), чужой адрес в письмо не попадёт
function buildLinks(mantraCode, siteUrl) {
  var site = siteUrl || SITE_URL;
  var code = String(mantraCode || '');
  var ok = code.length > 0 && code.length < 4000 && /^[A-Za-z0-9_-]+$/.test(code);
  return { video: site + 'video.html', mantra: ok ? site + 'mantra.html?m=' + code : '' };
}

function letterText(links) {
  return 'Здравствуй!\n\nТвоя видео-практика: ' + links.video +
    (links.mantra ? '\nТвоя мантра у свечи: ' + links.mantra : '') +
    '\n\nНайди тихое место, приглуши свет — и начинай, когда почувствуешь момент.\n\nШамани';
}

function letterHtml(links) {
  var mantra = links.mantra
    ? '<p style="margin:18px 0 0;font-size:15px;color:#A29AAE">А твоя мантра ждёт у свечи: ' +
      '<a href="' + links.mantra + '" style="color:#F0A84A">открыть мантру</a></p>'
    : '';
  return '' +
    '<div style="background:#0C0B12;padding:32px 16px;font-family:Georgia,\'Times New Roman\',serif">' +
    '<div style="max-width:520px;margin:0 auto;background:#13111B;border:1px solid #2C283B;border-radius:18px;padding:32px 28px;color:#EDE4CF">' +
    '<p style="margin:0 0 6px;font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#8E88C8">Шамани · видео-практика</p>' +
    '<h1 style="margin:0 0 14px;font-weight:400;font-size:30px;line-height:1.1">Твоё видео готово</h1>' +
    '<p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#A29AAE">Найди тихое место, приглуши свет — и начинай, когда почувствуешь момент.</p>' +
    '<a href="' + links.video + '" style="display:inline-block;background:#F0A84A;color:#1E1407;text-decoration:none;padding:13px 26px;border-radius:999px;font-size:16px">Смотреть видео</a>' +
    mantra +
    '<p style="margin:28px 0 0;font-size:13px;color:#6C6579">Письмо пришло, потому что этот адрес указали на сайте Шамани. Больше писем не будет.</p>' +
    '</div></div>';
}
