/* Форма в конце главной: почта → письмо со ссылкой на видео (и на мантру, если она уже сплетена). */
(() => {
  const form = document.getElementById('letter-form');
  const email = document.getElementById('letter-email');
  const send = document.getElementById('letter-send');
  const status = document.getElementById('letter-status');

  function say(text, kind) {
    status.textContent = text;
    status.className = 'letter-status' + (kind ? ' is-' + kind : '');
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const address = email.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(address)) {
      say('Похоже, в адресе опечатка.', 'error');
      email.focus();
      return;
    }
    if (!SiteConfig.subscribeUrl) {
      say('Отправка писем пока не настроена.', 'error');
      return;
    }

    // Ссылки в письме собирает сервер; от нас — только код мантры, если он есть
    let mantra = '';
    try {
      const last = localStorage.getItem('shamani:last') || '';
      mantra = new URLSearchParams(last.split('?')[1] || '').get('m') || '';
    } catch (err) { /* ignore */ }

    send.disabled = true;
    say('Отправляем…');
    try {
      // text/plain — чтобы Google Apps Script принял запрос без предварительного CORS-запроса
      const res = await fetch(SiteConfig.subscribeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ email: address, mantra, website: form.website.value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || res.status);
      form.reset();
      say('Письмо в пути. Если его нет пару минут — загляни в «Спам».', 'ok');
    } catch (err) {
      say('Не получилось отправить. Попробуй ещё раз чуть позже.', 'error');
    } finally {
      send.disabled = false;
    }
  });
})();
