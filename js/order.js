/* Страница заявки: по личной ссылке order.html?t=<токен> показывает, что с заявкой сейчас —
   ждёт оплаты, создаётся, готова (видео, текст, скачивание) или доступ уже закончился. */
(() => {
  const $ = (id) => document.getElementById(id);
  const VIEWS = ['lookup', 'pay', 'wait', 'ready', 'expired'];
  const local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  const token = new URLSearchParams(location.search).get('t');
  let poll = null;

  function show(name) {
    $('order-loading').hidden = true;
    VIEWS.forEach((v) => { $('view-' + v).hidden = v !== name; });
  }

  async function api(path, opts) {
    const res = await fetch('/api/' + path, { cache: 'no-store', ...opts });
    return res.json();
  }

  async function load() {
    let data;
    try { data = await api('orders/' + encodeURIComponent(token)); } catch (e) { data = null; }
    if (!data || !data.ok) {
      $('lookup-text').textContent = 'Заявка по этой ссылке не найдена. Проверь, что ссылка скопирована целиком, или найди заявку по номеру.';
      return show('lookup');
    }
    render(data.order);
  }

  function render(o) {
    document.querySelectorAll('[data-number]').forEach((el) => { el.textContent = o.number; });
    clearTimeout(poll);

    if (o.status === 'awaiting_payment') return show('pay');
    if (o.status === 'queued' || o.status === 'generating') {
      show('wait');
      $('stages').querySelectorAll('li').forEach((li) => {
        const s = li.dataset.stage;
        li.className = s === 'paid' ? 'is-done' : s === 'generating' && o.status === 'generating' ? 'is-now' : '';
      });
      $('wait-title').textContent = o.status === 'queued' ? 'Заявка в очереди' : 'Создаём твою мантру';
      poll = setTimeout(load, 4000); // ждём готовности без перезагрузки страницы
      return;
    }
    if (o.status === 'ready') return renderReady(o);
    show('expired');
  }

  function renderReady(o) {
    show('ready');
    const r = o.result;
    $('ready-title').textContent = r.title;
    document.title = r.title + ' · Шамани';

    const until = new Date(o.accessUntil);
    const days = Math.max(1, Math.ceil((o.accessUntil - Date.now()) / 86400000));
    $('access').textContent = `Страница открыта до ${until.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })} · ${plural(days, 'остался', 'осталось', 'осталось')} ${days} ${plural(days, 'день', 'дня', 'дней')}`;

    const file = (f) => `/api/media/${encodeURIComponent(token)}/${encodeURIComponent(f.name)}`;
    const video = o.files.find((f) => f.kind === 'mp4' || f.kind === 'webm');
    const poster = o.files.find((f) => f.kind === 'jpg' || f.kind === 'png');
    const audio = o.files.find((f) => ['mp3', 'm4a', 'wav', 'ogg'].includes(f.kind));

    const screen = $('screen');
    screen.hidden = !video;
    if (video && !screen.firstChild) {
      const el = document.createElement('video');
      el.controls = true;
      el.playsInline = true;
      el.preload = 'metadata';
      if (poster) el.poster = file(poster);
      el.src = file(video);
      screen.append(el);
    }
    $('audio').hidden = !audio;
    if (audio) $('audio').src = file(audio);

    $('ready-lines').innerHTML = '';
    r.lines.forEach((l, i) => {
      const li = document.createElement('li');
      li.textContent = l;
      if (i === 0) li.className = 'bija';
      $('ready-lines').append(li);
    });
    $('ready-note').textContent = r.note || '';

    const LABELS = { mp4: 'Видео', webm: 'Видео', mp3: 'Музыка', m4a: 'Музыка', wav: 'Музыка', ogg: 'Музыка', pdf: 'Мантра (PDF)', txt: 'Текст мантры' };
    const items = o.files.filter((f) => LABELS[f.kind]);
    if (!items.some((f) => f.kind === 'txt')) items.push({ name: 'mantra.txt', kind: 'txt' });
    $('downloads').innerHTML = '';
    items.forEach((f) => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.className = 'download';
      a.href = file(f) + '?download=1';
      a.innerHTML = `<b></b><span></span>`;
      a.querySelector('b').textContent = LABELS[f.kind];
      a.querySelector('span').textContent = '.' + f.kind + (f.size ? ' · ' + size(f.size) : '');
      li.append(a);
      $('downloads').append(li);
    });

    $('btn-expire').hidden = !local;
  }

  function plural(n, one, few, many) {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  }

  function size(b) {
    return b > 1048576 ? (b / 1048576).toFixed(1).replace('.', ',') + ' МБ' : Math.ceil(b / 1024) + ' КБ';
  }

  $('btn-pay').addEventListener('click', async (e) => {
    e.target.disabled = true;
    const data = await api(`orders/${encodeURIComponent(token)}/pay`, { method: 'POST' }).catch(() => null);
    e.target.disabled = false;
    if (data && data.ok) render(data.order);
  });

  $('btn-expire').addEventListener('click', async () => {
    const data = await api(`dev/orders/${encodeURIComponent(token)}/expire`, { method: 'POST' }).catch(() => null);
    if (data && data.ok) render(data.order);
  });

  $('lookup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const number = $('lookup-number').value.trim().toUpperCase();
    const email = $('lookup-email').value.trim();
    $('lookup-error').textContent = '';
    const data = await api('orders/lookup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ number, email }),
    }).catch(() => null);
    if (data && data.ok) {
      try { localStorage.setItem('shamani:order', data.token); } catch (err) { /* ignore */ }
      location.href = 'order.html?t=' + encodeURIComponent(data.token);
    } else {
      $('lookup-error').textContent = 'Не нашли заявку с таким номером и почтой.';
    }
  });

  if (token) load(); else show('lookup');
})();
