/* Страница свечи: читает мантру из ссылки, зажигает свечу,
   включает звуки стихии и ведёт круг повторений по чётках. */
(() => {
  const $ = (id) => document.getElementById(id);
  let data = null;
  try { data = Mantra.decode(new URLSearchParams(location.search).get('m') || ''); } catch (e) { data = null; }

  if (!data || !Array.isArray(data.lines) || !data.lines.length) {
    $('altar').hidden = true;
    $('altar-empty').hidden = false;
    return;
  }

  const lines = data.lines.map(String);
  const sphere = Mantra.SPHERES[data.sphere];
  const element = Mantra.ELEMENTS[data.element];

  $('altar-sphere').textContent = [sphere && sphere.label, element && element.label].filter(Boolean).join(' · ') || 'Мантра';
  $('altar-title').textContent = data.name ? `Мантра для тебя, ${data.name}` : 'Твоя мантра';
  if (data.intention) {
    $('altar-intent').textContent = `«${data.intention}»`;
    $('altar-intent').hidden = false;
  }
  $('bija-note').textContent = data.note || '';
  document.title = data.name ? `Мантра · ${data.name}` : 'Твоя мантра · Шамани';

  const list = $('mantra-lines');
  lines.forEach((l, i) => {
    const li = document.createElement('li');
    li.textContent = l;
    if (i === 0) li.className = 'bija';
    list.appendChild(li);
  });

  // звук: по умолчанию — сцена своей стихии
  const sel = $('sel-sound');
  if (element) {
    const auto = sel.querySelector(`option[value="${element.sound}"]`);
    if (auto) { auto.textContent += ' — твоя стихия'; sel.value = element.sound; }
  }

  const candle = Candle($('candle'));
  let total = +$('sel-rounds').value, done = 0, running = false, token = 0, wakeLock = null, introDone = false;
  candle.setBeads(total, done);

  function updateCount() {
    $('beads-count').textContent = `${done} / ${total}`;
    candle.setBeads(total, done);
  }
  updateCount();

  // --- голос ---
  const synth = 'speechSynthesis' in window ? window.speechSynthesis : null;
  let voice = null;
  function pickVoice() {
    if (!synth) return;
    const vs = synth.getVoices();
    voice = vs.find((v) => /^ru/i.test(v.lang) && /natural|online|google/i.test(v.name))
         || vs.find((v) => /^ru/i.test(v.lang)) || null;
    const chk = $('chk-voice');
    if (!voice && vs.length) {
      chk.checked = false;
      chk.disabled = true;
      $('voice-label').textContent = 'Русского голоса в браузере нет — читай вслух сам';
    }
  }
  if (synth) { pickVoice(); synth.onvoiceschanged = pickVoice; }
  else { $('chk-voice').checked = false; $('chk-voice').disabled = true; }

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  function speak(text, my, slow) {
    if (!synth || !voice || !$('chk-voice').checked) return wait(900 + text.length * 70);
    return new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(text.replace(/ · /g, ', '));
      u.voice = voice;
      u.lang = voice.lang;
      u.rate = slow ? 0.6 : 0.8;
      u.pitch = 0.85;
      let finished = false;
      const end = () => { if (!finished) { finished = true; resolve(); } };
      u.onend = end;
      u.onerror = end;
      setTimeout(end, 4000 + text.length * 160); // страховка, если браузер «забыл» событие
      if (my === token) synth.speak(u); else end();
    });
  }

  function highlight(i) {
    [...list.children].forEach((li, k) => li.classList.toggle('is-now', k === i));
  }

  async function run() {
    const my = ++token;
    if (data.name && !introDone) {
      introDone = true;
      await speak(`${data.name}, это твоя мантра.`, my);
      await wait(800);
    }
    while (my === token && done < total) {
      for (let i = 0; i < lines.length; i++) {
        if (my !== token) return;
        highlight(i);
        await speak(lines[i], my, i === 0);
        if (my !== token) return;
        await wait(i === 0 ? 900 : 500);
      }
      done++;
      updateCount();
      if (done < total) { highlight(-1); await wait(1400); }
    }
    if (my === token && done >= total) {
      highlight(-1);
      running = false;
      $('altar-status').textContent = `Круг завершён: ${total} повторений. Побудь в тишине, сколько захочется.`;
      $('btn-light').textContent = 'Начать новый круг';
      document.body.classList.remove('is-lit');
    }
  }

  async function light() {
    if (done >= total) { done = 0; updateCount(); }
    running = true;
    document.body.classList.add('is-lit');
    candle.setLit(true);
    Ambience.start(sel.value);
    $('btn-light').textContent = 'Погасить свечу';
    $('altar-status').textContent = '';
    try { if (navigator.wakeLock) wakeLock = await navigator.wakeLock.request('screen'); } catch (e) { wakeLock = null; }
    run();
  }

  function extinguish() {
    running = false;
    token++;
    if (synth) synth.cancel();
    Ambience.stop();
    candle.setLit(false);
    highlight(-1);
    document.body.classList.remove('is-lit');
    $('btn-light').textContent = done ? 'Зажечь снова' : 'Зажечь свечу';
    if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
  }

  $('btn-light').addEventListener('click', () => {
    if (running) extinguish();
    else if (done >= total) { Ambience.stop(); candle.setLit(false); done = 0; updateCount(); light(); }
    else light();
  });

  $('sel-rounds').addEventListener('change', (e) => {
    total = +e.target.value;
    if (done > total) done = total;
    updateCount();
  });

  sel.addEventListener('change', () => { if (running) Ambience.start(sel.value); });
  $('vol').addEventListener('input', (e) => Ambience.setVolume(+e.target.value));
  $('chk-voice').addEventListener('change', (e) => { if (!e.target.checked && synth) synth.cancel(); });

  $('btn-share').addEventListener('click', async (e) => {
    const btn = e.currentTarget, was = btn.textContent;
    try { await navigator.clipboard.writeText(location.href); btn.textContent = 'Ссылка скопирована'; }
    catch (err) { btn.textContent = 'Скопируй адрес из строки браузера'; }
    setTimeout(() => { btn.textContent = was; }, 2200);
  });

  try { localStorage.setItem('shamani:last', location.pathname.split('/').pop() + location.search); } catch (e) { /* ignore */ }
})();
