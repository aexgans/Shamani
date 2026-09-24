/* Шамани — словарь и генератор мантр.
   Подключается и на главной (анкета), и на странице свечи.
   Мантра целиком хранится в ссылке (?m=...), поэтому старые ссылки
   не ломаются, даже если словарь потом поменяется. */
const Mantra = (() => {
  const SPHERES = {
    love: {
      label: 'Любовь', hint: 'близость, нежность, отношения', bija: 'Ям',
      note: 'Ям — биджа-слог анахаты, сердечного центра.',
      lines: ['Моё сердце открыто, и любовь узнаёт дорогу ко мне',
              'Любовь во мне и вокруг меня, ей легко меня найти'],
    },
    abundance: {
      label: 'Изобилие', hint: 'деньги, дело, достаток', bija: 'Шрим',
      note: 'Шрим — биджа-слог изобилия и красоты.',
      lines: ['Изобилие течёт ко мне свободно и легко',
              'Я принимаю дары мира открытыми ладонями'],
    },
    health: {
      label: 'Здоровье', hint: 'тело, силы, восстановление', bija: 'Вам',
      note: 'Вам — биджа-слог свадхистханы, центра воды и жизненной силы.',
      lines: ['Каждая клетка моего тела дышит жизнью',
              'Моё тело помнит, как быть целым'],
    },
    calm: {
      label: 'Покой', hint: 'тишина, сон, равновесие', bija: 'Со Хам',
      note: 'Со Хам — «я есть То»: на «со» вдох, на «хам» выдох.',
      lines: ['Внутри меня тихо, как в озере до рассвета',
              'Я — спокойная гладь, по которой скользит свет'],
    },
    path: {
      label: 'Путь', hint: 'выбор, решение, предназначение', bija: 'Ом',
      note: 'Ом — изначальный звук, биджа аджны, центра внутреннего видения.',
      lines: ['Мой путь проясняется с каждым шагом',
              'Я слышу свой внутренний голос и иду за ним'],
    },
    voice: {
      label: 'Голос', hint: 'творчество, самовыражение', bija: 'Хам',
      note: 'Хам — биджа-слог вишуддхи, горлового центра.',
      lines: ['Мой голос звучит свободно и чисто',
              'Я творю, и мир откликается мне'],
    },
    protection: {
      label: 'Защита', hint: 'опора, границы, безопасность', bija: 'Лам',
      note: 'Лам — биджа-слог муладхары, корневого центра.',
      lines: ['Я под защитой, и земля держит меня',
              'Вокруг меня круг света, и тьма не переступит его'],
    },
  };

  // label — как показать в анкете, acc — как звучит после «Я отпускаю…»
  const RELEASE = {
    fear:        { label: 'Страх',        acc: 'страх' },
    anxiety:     { label: 'Тревога',      acc: 'тревогу' },
    resentment:  { label: 'Обида',        acc: 'обиду' },
    doubt:       { label: 'Сомнения',     acc: 'сомнения' },
    fatigue:     { label: 'Усталость',    acc: 'усталость' },
    control:     { label: 'Контроль',     acc: 'контроль' },
    loneliness:  { label: 'Одиночество',  acc: 'одиночество' },
    past:        { label: 'Прошлое',      acc: 'прошлое' },
  };

  const CALL = {
    clarity:  { label: 'Ясность' },
    strength: { label: 'Сила' },
    softness: { label: 'Мягкость' },
    courage:  { label: 'Смелость' },
    joy:      { label: 'Радость' },
    trust:    { label: 'Доверие' },
    peace:    { label: 'Покой' },
    love:     { label: 'Любовь' },
  };

  // sound — сцена для звуков природы на странице свечи
  const ELEMENTS = {
    fire:  { label: 'Огонь',  hint: 'треск костра',            sound: 'fire',
             release: 'как огонь превращает ветви в свет', verb: 'разгорается' },
    water: { label: 'Вода',   hint: 'волны и прибой',          sound: 'water',
             release: 'как река уносит опавшие листья',   verb: 'течёт' },
    earth: { label: 'Земля',  hint: 'лес и птицы',             sound: 'forest',
             release: 'как земля принимает опавшее',      verb: 'прорастает' },
    air:   { label: 'Воздух', hint: 'ветер в высокой траве',   sound: 'wind',
             release: 'как ветер развеивает пепел',       verb: 'дышит' },
  };

  const TIMES = {
    dawn:   { label: 'Рассвет', hint: 'до первых дел',        close: 'С этим рассветом я начинаюсь заново' },
    day:    { label: 'День',    hint: 'в паузе среди дел',    close: 'Этот день идёт со мной в одном ритме' },
    sunset: { label: 'Закат',   hint: 'когда день отпускает', close: 'Я отпускаю этот день с благодарностью' },
    night:  { label: 'Ночь',    hint: 'перед сном',           close: 'Ночь бережёт меня, пока я отдыхаю' },
  };

  function hash(str) {
    let h = 2166136261;
    for (const ch of str) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  function build(a) {
    const sphere = SPHERES[a.sphere], el = ELEMENTS[a.element], time = TIMES[a.time];
    const release = RELEASE[a.release], call = CALL[a.call];
    const name = (a.name || '').trim().slice(0, 40);
    const intention = (a.intention || '').trim().slice(0, 240);
    const seed = hash([name, intention, a.sphere, a.release, a.call, a.element, a.time].join('|'));
    const lines = [
      [sphere.bija, sphere.bija, sphere.bija].join(' · '),
      `Я отпускаю ${release.acc} — ${el.release}`,
      `Во мне ${el.verb} ${call.label.toLowerCase()}`,
      sphere.lines[seed % sphere.lines.length],
      time.close,
      'Ом. Шанти, шанти, шанти',
    ];
    return {
      v: 1, name, intention,
      sphere: a.sphere, element: a.element, time: a.time, release: a.release, call: a.call,
      lines, note: sphere.note,
    };
  }

  function sample() {
    return build({ sphere: 'calm', release: 'anxiety', call: 'clarity', element: 'water', time: 'night',
                   intention: 'Засыпать спокойно и просыпаться с ясной головой' });
  }

  // JSON → UTF-8 → base64url, чтобы мантра поместилась в ссылку
  function encode(obj) {
    const bytes = new TextEncoder().encode(JSON.stringify(obj));
    let bin = '';
    bytes.forEach((b) => { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function decode(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    const bytes = Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  function url(m) { return 'mantra.html?m=' + encode(m); }

  return { SPHERES, RELEASE, CALL, ELEMENTS, TIMES, build, sample, encode, decode, url };
})();
