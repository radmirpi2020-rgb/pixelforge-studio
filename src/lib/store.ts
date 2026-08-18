import { writable, derived } from 'svelte/store';
import type { AppSettings, ImageTask, MarketplacePreset, ProcessingOptions } from './types';
import { BASE_OPTIONS, makeWatermark } from './presets';

export const tasks = writable<ImageTask[]>([]);

export const options = writable<ProcessingOptions>({
  ...BASE_OPTIONS,
  watermark: makeWatermark()
});

export const customPresets = writable<MarketplacePreset[]>([]);
export const presetId = writable<string | null>(null);

export const settings = writable<AppSettings>({
  threads: 0,
  memoryGateMb: 768
});

export const busyWorkers = writable(0);
export const activeRawBytes = writable(0);
export const liveThreads = writable(0);
export const busyZip = writable(false);
export const busyPdf = writable(false);
export const comparator = writable<string | null>(null);
export const showSettings = writable(false);

export interface Toast {
  id: number;
  text: string;
  kind: 'info' | 'ok' | 'err';
}

export const toasts = writable<Toast[]>([]);

let toastSeq = 1;

export function pushToast(text: string, kind: Toast['kind'] = 'info', ms = 4200): void {
  const id = toastSeq++;
  toasts.update((l) => [...l, { id, text, kind }].slice(-4));
  setTimeout(() => {
    toasts.update((l) => l.filter((t) => t.id !== id));
  }, ms);
}

export const stats = derived(tasks, ($tasks) => {
  const done = $tasks.filter((t) => t.status === 'COMPLETED' && t.metrics);
  const processing = $tasks.filter((t) => t.status === 'PROCESSING').length;
  const queued = $tasks.filter((t) => t.status === 'QUEUED').length;
  const errors = $tasks.filter((t) => t.status === 'ERROR').length;
  const artifacts = done.filter((t) => t.artifactRisk).length;
  const before = done.reduce((s, t) => s + t.file.size, 0);
  const after = done.reduce((s, t) => s + (t.metrics?.processedSize ?? 0), 0);
  const savings = before > 0 ? (1 - after / before) * 100 : 0;
  return {
    total: $tasks.length,
    done: done.length,
    processing,
    queued,
    errors,
    artifacts,
    before,
    after,
    savings
  };
});