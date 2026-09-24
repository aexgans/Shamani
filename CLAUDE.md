# Шамани — заметки для Claude

- Статический сайт без сборки: чистые HTML/CSS/JS, скрипты подключаются обычными `<script>` (не модулями), глобальные объекты `Mantra`, `Candle`, `Ambience`.
- Интерфейс и тексты — на русском. Стиль «нейтральная мистика»: тёмная тема, токены цветов в начале `css/style.css`, шрифты Forum (заголовки, мантры) и Literata (текст).
- Мантра хранится целиком в ссылке `mantra.html?m=<base64url JSON>` — старые ссылки должны продолжать открываться, формат `v: 1` не ломать.
- Звуки синтезируются в `js/sound.js`, аудиофайлов нет.
- Локальный просмотр: `node serve.js` → http://localhost:5173
- Работаем через ветки и Pull Request, `main` = опубликованный сайт (GitHub Pages).
- Скиллы проекта лежат в `.claude/skills/`: `impeccable` (аудит и доработка UI), набор taste-skill (`design-taste-frontend`, `redesign-existing-projects`, `high-end-visual-design` и др.), `img2threejs` (3D-модели для Three.js по картинке; скриптам нужен Python 3.10+).
