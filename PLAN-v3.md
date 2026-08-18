# V3 — план и статус

## V3.0 — PWA (установка + офлайн) — ГОТОВО
- [x] Манифест + Service Worker (vite-plugin-pwa, Workbox)
- [x] Иконки 192/512 PNG + maskable, SVG-логотип
- [x] Кнопка «Установить» (beforeinstallprompt) в шапке
- [x] Офлайн-кэш после первого открытия (precache 15 записей, 674 КБ)

## V3.1 — PDF-каталог — ГОТОВО
- [x] Генерация каталога готовых фото в A4 PDF (сетка 3×3, подписи имя+размеры)
- [x] Воркер pdfWorker.ts (OffscreenCanvas → JPEG → jsPDF), UI не блокируется
- [x] Обход code-splitting jsPDF: стабы html2canvas/dompurify/canvg + inlineDynamicImports

## V3.2 — Экспорт и SEO — ГОТОВО
- [x] CSV-отчёт по метрикам пакета (BOM, `;`-разделители, строка ИТОГО)
- [x] SEO: og-теги, JSON-LD (SoftwareApplication + FAQ), keywords

## V3.3 — Публикация — ✓
- [x] Production-сборка 3.0.0, svelte-check 0 ошибок, E2E-тест v3 (PDF/CSV/PWA)
- [ ] Git-репозиторий и релиз

## Дальше (v4+)
- V4 Wasm-кодеки (MozJPEG/oxipng), пакетные профили
- V5 WebGPU AI-апскейлинг (Real-ESRGAN), AI-удаление фона (RMBG)