# PixelForge Studio v3

Пакетный медиа-комбайн в браузере: сжимайте, конвертируйте и трансформируйте сотни изображений
за секунды. **Файлы не покидают ваше устройство** — обработка идёт в Web Workers через
OffscreenCanvas и WebAssembly.

## Возможности

- **Пакетная обработка** — до 500 фото через пул потоков, UI не фризит
- **Форматы** — JPG · PNG · WebP · AVIF · BMP · TIFF · SVG → WebP / JPEG / PNG / AVIF
- **Методы** — качество, ресайз (CONTAIN/COVER/EXACT), Blur Pad, unsharp-резкость
- **Пресеты маркетплейсов** — Wildberries 900×1200, Ozon 1:1, Avito, Яндекс Маркет + свои (IndexedDB)
- **Приватность** — бинарная чистка EXIF/GPS/XMP/IPTC до декодирования
- **Водяные знаки** — текст/логотип, 6 позиций, диагональная сетка, наклон
- **Инспектор SSIM** — сравнение «до/после» со шторкой, zум 400%, PSNR, маркировка артефактов
- **Экспорт** — ZIP, папка (File System Access API), **PDF-каталог** (A4, сетка 3×3), **CSV-отчёт**
- **PWA** — установка одним кликом, полная офлайн-работа

## Быстрый старт

```bash
npm install
npm run dev      # разработка
npm run build    # production → dist/
npm run preview  # просмотр сборки
npm run check    # svelte-check
npm run icons    # перегенерация PNG-иконок
```

## Публикация

Production-сборка — папка `dist/` (SW + манифест внутри). Варианты:

1. **GitHub Pages / Netlify / Cloudflare Pages / Vercel** — загрузить `dist/` или подключить репозиторий.
2. **Локальная сеть** — `npm run preview -- --host` и открыть `http://<IP>:4173/`.

> PWA требует HTTPS (или localhost). После деплоя манифест и service worker заработают автоматически.

## Технологии

Svelte 4 · Vite 5 · TypeScript · Web Workers · OffscreenCanvas · fflate (ZIP) · jsPDF (PDF) · Workbox (PWA)

## Дорожная карта

- **v4** — Wasm-кодеки (MozJPEG/oxipng), пакетные профили
- **v5** — WebGPU AI-апскейлинг (Real-ESRGAN), AI-удаление фона (RMBG)

## Лицензия

MIT — используйте свободно.