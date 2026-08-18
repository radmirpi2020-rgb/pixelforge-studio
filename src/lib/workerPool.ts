import { get } from 'svelte/store';
import { tasks, settings, options, busyWorkers, activeRawBytes, liveThreads } from './store';
import type { ImageTask, WorkerOutMessage, WorkerTaskMessage } from './types';

interface Slot {
  worker: Worker;
  busyId: string | null;
  rawBytes: number;
}

export class ImagePool {
  readonly slots: Slot[] = [];

  liveCount(): number {
    return this.slots.length;
  }

  ensure(): void {
    const want = this.effectiveThreads();
    while (this.slots.length < want) this.slots.push(this.spawn());
    for (let i = this.slots.length - 1; i >= want; i--) {
      const s = this.slots[i];
      if (!s.busyId) {
        s.worker.terminate();
        this.slots.splice(i, 1);
      }
    }
    this.syncStores();
  }

  effectiveThreads(): number {
    const t = get(settings).threads;
    if (t > 0) return t;
    return Math.max(1, Math.min((navigator.hardwareConcurrency || 4) - 1, 6));
  }

  private spawn(): Slot {
    const slot: Slot = { worker: null as unknown as Worker, busyId: null, rawBytes: 0 };
    const worker = new Worker(new URL('../workers/imageWorker.ts', import.meta.url), {
      type: 'module'
    });
    worker.onmessage = (ev: MessageEvent) => this.onMessage(slot, ev.data as WorkerOutMessage);
    worker.onerror = () => {
      if (slot.busyId) {
        const id = slot.busyId;
        slot.busyId = null;
        slot.rawBytes = 0;
        this.patchTask(id, (t) => {
          t.status = 'ERROR';
          t.errorMessage = 'Ошибка воркера (возможно, не хватило памяти)';
          t.progress = 0;
        });
        this.syncStores();
        this.pump();
      }
    };
    slot.worker = worker;
    return slot;
  }

  pump(): void {
    const gate = get(settings).memoryGateMb * 1024 * 1024;
    let used = this.slots.reduce((s, sl) => s + sl.rawBytes, 0);
    for (const sl of this.slots) {
      if (sl.busyId) continue;
      const next = get(tasks).find((t) => t.status === 'QUEUED');
      if (!next) break;
      const est = this.estimateRawBytes(next);
      if (used + est > gate) continue;
      sl.busyId = next.id;
      sl.rawBytes = est;
      used += est;
      this.patchTask(next.id, (t) => {
        t.status = 'PROCESSING';
        t.progress = 5;
      });
      const opts = { ...get(options), ...(next.customOverrides ?? {}) };
      const msg: WorkerTaskMessage = { t: 'task', id: next.id, file: next.file, opts };
      if (opts.watermark?.type === 'IMAGE' && opts.watermark.imageBlob) {
        msg.logo = opts.watermark.imageBlob;
      }
      sl.worker.postMessage(msg);
    }
    this.syncStores();
  }

  cancel(id: string): void {
    const idx = this.slots.findIndex((s) => s.busyId === id);
    if (idx >= 0) {
      this.slots[idx].worker.terminate();
      this.slots[idx] = this.spawn();
      this.patchTask(id, (t) => {
        t.status = 'CANCELLED';
      });
      this.syncStores();
      this.pump();
    } else {
      this.patchTask(id, (t) => {
        t.status = 'CANCELLED';
      });
    }
  }

  private estimateRawBytes(t: ImageTask): number {
    if (t.originalWidth > 0) {
      return Math.min(t.originalWidth * t.originalHeight * 4, 1.5 * 1024 ** 3);
    }
    return Math.min(t.file.size * 4, 512 * 1024 * 1024);
  }

  private onMessage(sl: Slot, m: WorkerOutMessage): void {
    switch (m.t) {
      case 'progress': {
        this.patchTask(m.id, (t) => {
          if (t.status === 'PROCESSING') t.progress = Math.max(t.progress, m.stage);
        });
        break;
      }
      case 'raw': {
        if (sl.busyId === m.id) {
          sl.rawBytes = m.bytes;
          this.syncStores();
        }
        break;
      }
      case 'done': {
        const id = sl.busyId;
        sl.busyId = null;
        sl.rawBytes = 0;
        const t = this.findTask(m.id);
        if (t && t.status === 'PROCESSING') {
          this.patchTask(m.id, (task) => {
            task.status = 'COMPLETED';
            task.progress = 100;
            task.resultBlob = m.result.blob;
            task.artifactRisk = m.result.ssim != null && m.result.ssim < 0.92;
            task.metrics = {
              originalSize: task.file.size,
              processedSize: m.result.blob.size,
              compressionRatio: task.file.size
                ? (1 - m.result.blob.size / task.file.size) * 100
                : 0,
              processingTimeMs: m.result.processingTimeMs,
              ssimScore: m.result.ssim,
              psnrDb: m.result.psnr,
              fallbackFormat: m.result.fallbackFormat,
              outWidth: m.result.width,
              outHeight: m.result.height
            };
          });
        }
        this.syncStores();
        this.pump();
        break;
      }
      case 'error': {
        const id = sl.busyId;
        sl.busyId = null;
        sl.rawBytes = 0;
        const t = this.findTask(m.id);
        if (t && t.status === 'PROCESSING' && id === m.id) {
          this.patchTask(m.id, (task) => {
            task.status = 'ERROR';
            task.errorMessage = m.message;
            task.progress = 0;
          });
        }
        this.syncStores();
        this.pump();
        break;
      }
    }
  }

  private findTask(id: string): ImageTask | undefined {
    return get(tasks).find((t) => t.id === id);
  }

  private patchTask(id: string, fn: (t: ImageTask) => void): void {
    tasks.update((list) => {
      const idx = list.findIndex((x) => x.id === id);
      if (idx === -1) return list;
      const copy = { ...list[idx] };
      fn(copy);
      const out = list.slice();
      out[idx] = copy;
      return out;
    });
  }

  private syncStores(): void {
    busyWorkers.set(this.slots.filter((s) => s.busyId).length);
    activeRawBytes.set(this.slots.reduce((s, sl) => s + sl.rawBytes, 0));
    liveThreads.set(this.slots.length);
  }
}