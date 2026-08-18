import { get } from 'svelte/store';
import { tasks, options, busyZip, busyPdf, pushToast, comparator } from './store';
import { ImagePool } from './workerPool';
import { downloadPdfCatalog, downloadZip, renderName, saveToFolder, triggerDownload, uniqueName } from './download';
import { fmtBytes } from './format';
import { uid } from './uuid';
import type { ImageTask, ProcessingOptions } from './types';

const MAX_FILES = 500;
const EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'avif', 'bmp', 'tif', 'tiff', 'svg'];

let pool: ImagePool | null = null;

export function initQueue(): void {
  if (pool) return;
  pool = new ImagePool();
  pool.ensure();
}

export function ensurePool(): void {
  pool?.ensure();
}

export function poolLiveCount(): number {
  return pool ? pool.liveCount() : 0;
}

function currentOptions(): ProcessingOptions {
  return get(options);
}

export function isSupportedImage(f: File): boolean {
  if (f.type && f.type.startsWith('image/')) return true;
  const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
  return EXTENSIONS.includes(ext);
}

export async function addFiles(files: File[]): Promise<void> {
  const accepted = files.filter(isSupportedImage);
  const skipped = files.length - accepted.length;
  if (skipped > 0) {
    pushToast(`Пропущено неподдерживаемых файлов: ${skipped}`, 'info');
  }
  if (!accepted.length) {
    pushToast('Нет изображений для обработки', 'err');
    return;
  }
  const $tasks = get(tasks);
  const room = MAX_FILES - $tasks.length;
  if (room <= 0) {
    pushToast(`Лимит очереди — ${MAX_FILES} файлов. Очистите очередь`, 'err');
    return;
  }
  const toAdd = accepted.slice(0, room);
  if (toAdd.length < accepted.length) {
    pushToast(`Добавлено ${room} из ${accepted.length} (лимит очереди)`, 'info');
  }
  const newTasks: ImageTask[] = toAdd.map((f) => ({
    id: uid(),
    file: f,
    relativePath: f.webkitRelativePath || undefined,
    previewUrl: '',
    originalWidth: 0,
    originalHeight: 0,
    status: 'QUEUED',
    progress: 0
  }));
  tasks.update((list) => [...list, ...newTasks]);
  await Promise.all(newTasks.map((t) => makeThumbnail(t)));
  pool?.pump();
}

async function makeThumbnail(t: ImageTask): Promise<void> {
  try {
    const bmp = await createImageBitmap(t.file, { imageOrientation: 'none' });
    t.originalWidth = bmp.width;
    t.originalHeight = bmp.height;
    const max = 96;
    const sc = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const cw = Math.max(1, Math.round(bmp.width * sc));
    const ch = Math.max(1, Math.round(bmp.height * sc));
    const c = document.createElement('canvas');
    c.width = cw;
    c.height = ch;
    const ctx = c.getContext('2d');
    if (ctx) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(bmp, 0, 0, cw, ch);
    }
    bmp.close();
    const thumb = await new Promise<Blob>((res, rej) =>
      c.toBlob((b) => (b ? res(b) : rej(new Error('thumb'))), 'image/jpeg', 0.8)
    );
    t.previewUrl = URL.createObjectURL(thumb);
    tasks.update((list) => {
      const idx = list.findIndex((x) => x.id === t.id);
      if (idx === -1) return list;
      const out = list.slice();
      out[idx] = t;
      return out;
    });
  } catch {
    t.status = 'ERROR';
    t.errorMessage = 'Не удалось открыть изображение (файл повреждён или формат не поддерживается)';
    t.previewUrl = '';
    tasks.update((list) => {
      const idx = list.findIndex((x) => x.id === t.id);
      if (idx === -1) return list;
      const out = list.slice();
      out[idx] = t;
      return out;
    });
  }
}

export function removeTask(id: string): void {
  if (get(comparator) === id) comparator.set(null);
  pool?.cancel(id);
  tasks.update((list) => {
    const t = list.find((x) => x.id === id);
    if (t?.previewUrl) URL.revokeObjectURL(t.previewUrl);
    return list.filter((x) => x.id !== id);
  });
}

export function clearAll(): void {
  for (const sl of pool?.slots ?? []) {
    if (sl.busyId) {
      sl.worker.terminate();
      sl.busyId = null;
      sl.rawBytes = 0;
    }
  }
  if (pool) {
    pool.slots.length = 0;
    pool.ensure();
  }
  for (const t of get(tasks)) {
    if (t.previewUrl) URL.revokeObjectURL(t.previewUrl);
  }
  comparator.set(null);
  tasks.set([]);
}

export function retryTask(id: string): void {
  tasks.update((list) => {
    const idx = list.findIndex((x) => x.id === id);
    if (idx === -1) return list;
    const copy = { ...list[idx] };
    copy.status = 'QUEUED';
    copy.progress = 0;
    copy.errorMessage = undefined;
    copy.resultBlob = undefined;
    copy.metrics = undefined;
    copy.artifactRisk = false;
    const out = list.slice();
    out[idx] = copy;
    return out;
  });
  pool?.pump();
}

export function reprocessTask(id: string, overrides: Partial<ProcessingOptions>): void {
  tasks.update((list) => {
    const idx = list.findIndex((x) => x.id === id);
    if (idx === -1) return list;
    const copy = { ...list[idx] };
    copy.customOverrides = { ...(copy.customOverrides ?? {}), ...overrides };
    copy.status = 'QUEUED';
    copy.progress = 0;
    copy.resultBlob = undefined;
    copy.metrics = undefined;
    copy.artifactRisk = false;
    copy.errorMessage = undefined;
    const out = list.slice();
    out[idx] = copy;
    return out;
  });
  pool?.pump();
}

function collectItems(): { name: string; blob: Blob; size: number }[] {
  const opts = currentOptions();
  const used = new Set<string>();
  const items: { name: string; blob: Blob; size: number }[] = [];
  for (const t of get(tasks)) {
    if (t.status !== 'COMPLETED' || !t.resultBlob || !t.metrics) continue;
    const name = uniqueName(renderName(t, opts), used);
    items.push({ name, blob: t.resultBlob, size: t.resultBlob.size });
  }
  return items;
}

export async function downloadZipAll(): Promise<void> {
  const items = collectItems().map((i) => ({ name: i.name, blob: i.blob }));
  if (!items.length) {
    pushToast('Нет готовых файлов для архива', 'err');
    return;
  }
  busyZip.set(true);
  try {
    const total = items.reduce((s, i) => s + i.blob.size, 0);
    const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const name = `pixelforge_${stamp}.zip`;
    await downloadZip(items, name);
    pushToast(`Архив ${name} (${fmtBytes(total)}) готов`, 'ok');
  } catch (e) {
    pushToast(e instanceof Error ? e.message : 'Ошибка сборки архива', 'err');
  } finally {
    busyZip.set(false);
  }
}

export async function downloadPdfAll(): Promise<void> {
  const items = collectItems().map((i) => ({ name: i.name, blob: i.blob }));
  if (!items.length) {
    pushToast('Нет готовых файлов для каталога', 'err');
    return;
  }
  busyPdf.set(true);
  try {
    const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const { pages, count } = await downloadPdfCatalog(
      items,
      'PixelForge Studio — каталог изображений',
      `pixelforge_catalog_${stamp}.pdf`
    );
    pushToast(`PDF-каталог готов: ${count} фото, ${pages} стр.`, 'ok');
  } catch (e) {
    pushToast(e instanceof Error ? e.message : 'Ошибка генерации PDF', 'err');
  } finally {
    busyPdf.set(false);
  }
}

export function exportCsvReport(): void {
  const opts = currentOptions();
  const done = get(tasks).filter((t) => t.status === 'COMPLETED' && t.metrics);
  if (!done.length) {
    pushToast('Нет завершённых задач для отчёта', 'err');
    return;
  }
  const esc = (s: string): string => (/[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const lines: string[] = [
    'Имя файла;Формат;До (КБ);После (КБ);Экономия %;SSIM;PSNR (дБ);Время (мс);Ширина;Высота'
  ];
  for (const t of done) {
    const m = t.metrics;
    if (!m) continue;
    lines.push(
      [
        esc(t.file.name),
        t.file.type || 'image',
        (m.originalSize / 1024).toFixed(1),
        (m.processedSize / 1024).toFixed(1),
        m.compressionRatio.toFixed(1),
        m.ssimScore != null ? m.ssimScore.toFixed(3) : '',
        m.psnrDb != null ? m.psnrDb.toFixed(1) : '',
        m.processingTimeMs.toFixed(0),
        String(m.outWidth),
        String(m.outHeight)
      ].join(';')
    );
  }
  lines.push(
    [
      'ИТОГО',
      '',
      (done.reduce((s, t) => s + t.metrics!.originalSize, 0) / 1024).toFixed(1),
      (done.reduce((s, t) => s + t.metrics!.processedSize, 0) / 1024).toFixed(1),
      (() => {
        const b = done.reduce((s, t) => s + t.metrics!.originalSize, 0);
        const a = done.reduce((s, t) => s + t.metrics!.processedSize, 0);
        return b > 0 ? (((1 - a / b) * 100)).toFixed(1) : '0.0';
      })(),
      '',
      '',
      '',
      '',
      ''
    ].join(';')
  );
  const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
  const blob = new Blob(['\uFEFF' + lines.join('\r\n') + '\r\n'], {
    type: 'text/csv;charset=utf-8'
  });
  triggerDownload(blob, `pixelforge_report_${stamp}.csv`);
  pushToast(`CSV-отчёт сохранён: ${done.length} фото (${opts.outputFormat.toUpperCase()})`, 'ok');
}

export async function saveToFolderAll(): Promise<void> {
  const items = collectItems().map((i) => ({ name: i.name, blob: i.blob }));
  if (!items.length) {
    pushToast('Нет готовых файлов для сохранения', 'err');
    return;
  }
  try {
    const n = await saveToFolder(items);
    const total = items.reduce((s, i) => s + i.blob.size, 0);
    pushToast(`Сохранено файлов: ${n} (${fmtBytes(total)})`, 'ok');
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return;
    pushToast(e instanceof Error ? e.message : 'Ошибка сохранения в папку', 'err');
  }
}