/* Главная: анкета-обряд из семи вопросов → готовая мантра. */
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
  ];

  const $ = (id) => document.getElementById(id);
  const form = $('rite-form'), body = $('rite-body'), moons = $('moons');
  const answers = {};
  let step = 0;

  moons.innerHTML = STEPS.map(() => '<span class="moon"></span>').join('');

  function render() {
    const s = STEPS[step];
    $('rite-step').textContent = `Вопрос ${step + 1} из ${STEPS.length}`;
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
      body.innerHTML = `<${tag} class="field" id="${s.id}" name="${s.id}" maxlength="${s.type === 'textarea' ? 240 : 40}"
        placeholder="${s.placeholder}" autocomplete="off"${tag === 'textarea' ? ' rows="3"></textarea>' : ' type="text">'}`;
      body.querySelector('.field').value = answers[s.id] || '';
    }

    $('btn-back').hidden = step === 0;
    $('btn-next').textContent = step === STEPS.length - 1 ? 'Сплести мантру' : 'Дальше';
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
    else weave();
  }

  function focusStep() {
    const f = body.querySelector('.field, input[type=radio]:checked, input[type=radio]');
    if (f) f.focus({ preventScroll: true });
  }

  form.addEventListener('submit', (e) => { e.preventDefault(); next(); });
  $('btn-back').addEventListener('click', () => { if (step > 0) { step--; render(); focusStep(); } });

  let current = null;

  function weave() {
    current = Mantra.build(answers);
    form.hidden = true;
    $('rite-step').hidden = true;
    $('weaving').hidden = false;
    [...moons.children].forEach((m) => { m.className = 'moon is-full'; });
    setTimeout(showResult, 1800);
  }

  function showResult() {
    $('weaving').hidden = true;
    const link = Mantra.url(current);
    $('result-lines').innerHTML = current.lines
      .map((l, i) => `<p class="${i === 0 ? 'bija' : ''}">${escapeHtml(l)}</p>`).join('');
    $('result-note').textContent = current.note;
    $('btn-open').href = link;
    $('result').hidden = false;
    try { localStorage.setItem('shamani:last', link); } catch (e) { /* без хранилища просто не запомним */ }
    showLastLink();
  }

  $('btn-copy').addEventListener('click', async (e) => {
    const text = current.lines.join('\n');
    try { await navigator.clipboard.writeText(text); flash(e.target, 'Скопировано'); }
    catch (err) { selectText($('result-lines')); flash(e.target, 'Выделено — нажми Ctrl+C'); }
  });

  $('btn-again').addEventListener('click', () => {
    Object.keys(answers).forEach((k) => delete answers[k]);
    step = 0;
    $('result').hidden = true;
    form.hidden = false;
    $('rite-step').hidden = false;
    render();
    focusStep();
  });

  function flash(btn, text) {
    const was = btn.textContent;
    btn.textContent = text;
    setTimeout(() => { btn.textContent = was; }, 1800);
  }

  function selectText(el) {
    const r = document.createRange();
    r.selectNodeContents(el);
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function showLastLink() {
    let last = null;
    try { last = localStorage.getItem('shamani:last'); } catch (e) { /* ignore */ }
    if (last) { $('last-link').href = last; $('last-link').hidden = false; }
  }

  $('sample-link').href = Mantra.url(Mantra.sample());
  showLastLink();
  render();
})();
