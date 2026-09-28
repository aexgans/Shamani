/* Страница видео: файл через <video> или встраивание VK Видео / Rutube / YouTube. */
(() => {
  const v = SiteConfig.video;
  const $ = (id) => document.getElementById(id);

  $('video-title').textContent = v.title;
  document.title = v.title + ' · Шамани';
  $('video-text').textContent = v.text;
  $('video-text').hidden = !v.text;

  const screen = $('screen');
  const embed = toEmbed(v.embed);

  if (embed) {
    const f = document.createElement('iframe');
    f.src = embed;
    f.title = v.title;
    f.allow = 'autoplay; encrypted-media; fullscreen; picture-in-picture';
    f.allowFullscreen = true;
    screen.append(f);
  } else {
    const el = document.createElement('video');
    el.controls = true;
    el.playsInline = true;
    el.preload = 'metadata';
    if (v.poster) el.poster = v.poster;
    el.src = v.src;
    el.addEventListener('error', () => {
      screen.innerHTML = '<p class="screen-error">Видео не загрузилось. Обнови страницу или загляни позже.</p>';
    });
    screen.append(el);
  }

  // Обычные ссылки «посмотреть» превращаем в ссылки для встраивания
  function toEmbed(url) {
    if (!url) return '';
    let m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{11})/);
    if (m) return `https://www.youtube-nocookie.com/embed/${m[1]}`;
    m = url.match(/rutube\.ru\/video\/([0-9a-f]{32})/);
    if (m) return `https://rutube.ru/play/embed/${m[1]}`;
    return url; // VK Видео и остальные — ссылка из кода встраивания (…/video_ext.php?…)
  }

  let last = null;
  try { last = localStorage.getItem('shamani:last'); } catch (e) { /* ignore */ }
  if (last) { $('mantra-link').href = last; $('mantra-link').textContent = 'Вернуться к своей мантре'; }
})();
