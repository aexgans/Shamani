/* Главная: анкета-обряд из семи вопросов + почта → заявка на мантру и видео. */
(() => {
  const opts = (dict) => Object.entries(dict).map(([id, o]) => ({ id, label: o.label, hint: o.hint }));

  const STEPS = [
    { id: 'name', type: 'text', title: 'Как к тебе обращаться?',
      hint: 'Имя прозвучит в начале практики. Можно пропустить.', placeholder: 'Например, Анна' },
    { id: 'sphere', type: 'choice', title: 'О чём твоя мантра?',
      hint: 'Выбери то, что сейчас важнее всего.', options: opts(Mantra.SPHERES) },
    { id: 'release', type: 'choice', title: 'Что ты хочешь отпустить?',
      hint: 'То, что забирает силы.', options: opts(Mantra.RELEASE) },
    { id: 'call', type: 'choice', title: 'Что ты зовёшь взамен?',
      hint: 'Качество, которому нужно место внутри.', options: opts(Mantra.CALL) },
    { id: 'element', type: 'choice', title: 'Какая стихия тебе ближе?',
      hint: 'Её звуки будут звучать у свечи.', options: opts(Mantra.ELEMENTS) },
    { id: 'time', type: 'choice', title: 'Когда ты будешь практиковать?',
      hint: 'От этого зависит последняя строка мантры.', options: opts(Mantra.TIMES) },
    { id: 'intention', type: 'textarea', title: 'Скажи своё намерение своими словами',
      hint: 'Одна-две фразы. Они будут рядом с мантрой, пока горит свеча. Можно пропустить.',
      placeholder: 'Например: хочу перестать бояться перемен' },
    { id: 'email', type: 'email', title: 'Куда прислать мантру?',
      hint: 'Мантра, музыка и видео будут готовы примерно через пять минут — пришлём ссылку на эту почту.',
      placeholder: 'твоя@почта.ru' },
  ];
  const QUESTIONS = STEPS.filter((s) => s.type !== 'email').length;

  const $ = (id) => document.getElementById(id);
  const form = $('rite-form'), body = $('rite-body'), moons = $('moons');
  const answers = {};
  let step = 0;

  moons.innerHTML = STEPS.slice(0, QUESTIONS).map(() => '<span class="moon"></span>').join('');

  function render() {
    const s = STEPS[step];
    $('rite-step').textContent = step < QUESTIONS ? `Вопрос ${step + 1} из ${QUESTIONS}` : 'Последний шаг';
    $('rite-title').textContent = s.title;
    $('rite-hint').textContent = s.hint;
    [...moons.children].forEach((m, i) => {
      m.className = 'moon' + (i < step ? ' is-full' : i === step ? ' is-now' : '');
    });

    if (s.type === 'choice') {
      body.innerHTML = `<div class="chips${s.options.length > 6 ? ' chips-dense' : ''}" role="radiogroup" aria-labelledby="rite-title">` +
        s.options.map((o) => `
          <label class="chip">
            <input type="radio" name="${s.id}" id="${s.id}-${o.id}" value="${o.id}"${answers[s.id] === o.id ? ' checked' : ''}>
            <span class="chip-label">${o.label}</span>
            ${o.hint ? `<span class="chip-hint">${o.hint}</span>` : ''}
          </label>`).join('') + '</div>';
    } else {
      const tag = s.type === 'textarea' ? 'textarea' : 'input';
      const attrs = s.type === 'email'
        ? ' type="email" inputmode="email" autocomplete="email" maxlength="120">'
          + '<input class="visually-hidden" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">'
          + '<p class="rite-error" id="rite-error" role="alert"></p>'
        : tag === 'textarea' ? ' autocomplete="off" rows="3" maxlength="240"></textarea>' : ' type="text" autocomplete="off" maxlength="40">';
      body.innerHTML = `<${tag} class="field" id="${s.id}" name="${s.id}" placeholder="${s.placeholder}"${attrs}`;
      body.querySelector('.field').value = answers[s.id] || '';
    }

    $('btn-back').hidden = step === 0;
    $('btn-next').textContent = step === STEPS.length - 1 ? 'Оформить заявку' : 'Дальше';
    syncNext();
  }

  function syncNext() {
    const s = STEPS[step];
    $('btn-next').disabled = s.type === 'choice' && !answers[s.id];
  }

  let lastPointer = 0;
  body.addEventListener('pointerup', () => { lastPointer = Date.now(); });

  body.addEventListener('change', (e) => {
    if (e.target.type !== 'radio') return;
    answers[e.target.name] = e.target.value;
    syncNext();
    // выбор мышью или пальцем — сразу к следующему вопросу; стрелки клавиатуры не перелистывают
    if (Date.now() - lastPointer > 800) return;
    const at = step;
    setTimeout(() => { if (step === at) next(); }, 280);
  });

  body.addEventListener('input', (e) => {
    if (e.target.classList.contains('field')) answers[e.target.name] = e.target.value;
  });

  function next() {
    const s = STEPS[step];
    if (s.type === 'choice' && !answers[s.id]) return;
    if (step < STEPS.length - 1) { step++; render(); focusStep(); }
    else submitOrder();
  }

  function focusStep() {
    const f = body.querySelector('.field, input[type=radio]:checked, input[type=radio]');
    if (f) f.focus({ preventScroll: true });
  }

  form.addEventListener('submit', (e) => { e.preventDefault(); next(); });
  $('btn-back').addEventListener('click', () => { if (step > 0) { step--; render(); focusStep(); } });

  async function submitOrder() {
    const email = (answers.email || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      $('rite-error').textContent = 'Похоже, в адресе опечатка.';
      body.querySelector('.field').focus();
      return;
    }
    const { email: _, ...rest } = answers;
    form.hidden = true;
    $('rite-step').hidden = true;
    $('weaving').hidden = false;
    [...moons.children].forEach((m) => { m.className = 'moon is-full'; });
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, answers: rest, website: form.website ? form.website.value : '' }),
      });
      const data = await res.json();
      if (!data.ok || !data.token) throw new Error(data.error);
      try { localStorage.setItem('shamani:order', data.token); } catch (e) { /* без хранилища просто не запомним */ }
      location.href = 'order.html?t=' + encodeURIComponent(data.token);
    } catch (err) {
      $('weaving').hidden = true;
      form.hidden = false;
      $('rite-step').hidden = false;
      render();
      $('rite-error').textContent = 'Не получилось оформить заявку. Попробуй ещё раз.';
    }
  }

  // Последняя заявка — ссылка «Моя заявка» ведёт сразу на неё
  try {
    const last = localStorage.getItem('shamani:order');
    if (last) $('order-link').href = 'order.html?t=' + encodeURIComponent(last);
  } catch (e) { /* ignore */ }

  $('sample-link').href = Mantra.url(Mantra.sample());
  render();
})();
