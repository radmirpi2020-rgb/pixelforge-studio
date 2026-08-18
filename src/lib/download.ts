import type { ImageTask, ProcessingOptions, SupportedOutputFormat } from './types';

export function extOf(f: SupportedOutputFormat): string {
  return f === 'jpeg' ? 'jpg' : f;
}

export function renderName(task: ImageTask, opts: ProcessingOptions): string {
  const ext = extOf(opts.outputFormat);
  const base = task.file.name.replace(/\.[^.]+$/, '') || 'image';
  let out = opts.outputNameTemplate
    .replace('{name}', base)
    .replace('{w}', String(task.metrics?.outWidth ?? task.originalWidth))
    .replace('{h}', String(task.metrics?.outHeight ?? task.originalHeight))
    .replace('{ext}', ext);
  out = out.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim();
  const full = out ? `${out}.${ext}` : `${base}.${ext}`;
  return full.replace(/^_+/, '');
}

export function uniqueName(base: string, used: Set<string>): string {
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  const dot = base.lastIndexOf('.');
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const ext = dot > 0 ? base.slice(dot) : '';
  let n = 2;
  let out = `${stem}_${n}${ext}`;
  while (used.has(out)) {
    n++;
    out = `${stem}_${n}${ext}`;
  }
  used.add(out);
  return out;
}

export function triggerDownload(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export function downloadZip(items: { name: string; blob: Blob }[], archiveName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const w = new Worker(new URL('../workers/zipWorker.ts', import.meta.url), { type: 'module' });
    const timer = setTimeout(() => {
      w.terminate();
      reject(new Error('Таймаут сборки архива'));
    }, 300000);
    w.onmessage = (ev) => {
      if (ev.data && ev.data.t === 'zip') {
        clearTimeout(timer);
        w.terminate();
        triggerDownload(ev.data.blob, archiveName);
        resolve();
      }
    };
    w.onerror = () => {
      clearTimeout(timer);
      w.terminate();
      reject(new Error('Ошибка сборки ZIP-архива'));
    };
    w.postMessage({ t: 'build', items });
  });
}

export function downloadPdfCatalog(
  items: { name: string; blob: Blob }[],
  title: string,
  fileName: string
): Promise<{ pages: number; count: number }> {
  return new Promise((resolve, reject) => {
    const w = new Worker(new URL('../workers/pdfWorker.ts', import.meta.url), { type: 'module' });
    const timer = setTimeout(() => {
      w.terminate();
      reject(new Error('Таймаут генерации PDF'));
    }, 300000);
    w.onmessage = (ev) => {
      const d = ev.data;
      if (d && d.t === 'pdf') {
        clearTimeout(timer);
        w.terminate();
        triggerDownload(d.blob, fileName);
        resolve({ pages: d.pages, count: d.count });
      }
      if (d && d.t === 'error') {
        clearTimeout(timer);
        w.terminate();
        reject(new Error(d.message || 'Ошибка генерации PDF'));
      }
    };
    w.onerror = () => {
      clearTimeout(timer);
      w.terminate();
      reject(new Error('Ошибка генерации PDF'));
    };
    w.postMessage({ t: 'build', title, items });
  });
}

interface DirHandle {
  getFileHandle: (name: string, opts: { create: boolean }) => Promise<FileHandle>;
}

interface FileHandle {
  createWritable: () => Promise<WritableStream & { write: (b: Blob) => Promise<void>; close: () => Promise<void> }>;
}

export async function saveToFolder(items: { name: string; blob: Blob }[]): Promise<number> {
  const anyWin = window as unknown as {
    showDirectoryPicker?: () => Promise<DirHandle>;
  };
  if (typeof anyWin.showDirectoryPicker !== 'function') {
    throw new Error('Сохранение в папку доступно только в Chrome/Edge');
  }
  const dir = await anyWin.showDirectoryPicker();
  let n = 0;
  for (const it of items) {
    const fh = await dir.getFileHandle(it.name, { create: true });
    const wr = await (fh as unknown as FileHandle).createWritable();
    await wr.write(it.blob);
    await wr.close();
    n++;
  }
  return n;
}

