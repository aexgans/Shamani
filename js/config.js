/* Настройки сайта, которые меняются без правки кода. */
const SiteConfig = (() => {
  const local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);

  return {
    // Видео на странице video.html. Два варианта:
    //  1) файл: src — путь или ссылка на .mp4/.webm (лучше внешний хостинг, в репозитории держим только маленькие);
    //  2) embed — ссылка встраивания VK Видео / Rutube / YouTube (тогда src игнорируется).
    video: {
      title: 'Практика у свечи',
      text: 'Тестовое видео. Замени его в js/config.js на своё.',
      src: 'media/test-video.mp4',
      poster: 'media/test-poster.jpg',
      embed: '',
    },

    // Куда отправлять почту из формы «Получить видео».
    // Локально — заглушка в serve.js (письма падают в папку .dev-mail/).
    // На сайте — адрес веб-приложения Google Apps Script, см. backend/README.md.
    subscribeUrl: local ? '/api/subscribe' : '',
  };
})();
