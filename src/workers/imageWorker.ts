import { processImage } from '../lib/pipeline';
import { WorkerCanvasHost } from '../lib/canvasHost';
import type { WorkerOutMessage, WorkerTaskMessage } from '../lib/types';

const host = new WorkerCanvasHost();

function post(m: WorkerOutMessage, transfer?: Transferable[]): void {
  (self as unknown as Worker).postMessage(m, transfer as Transferable[]);
}

addEventListener('message', (ev: MessageEvent) => {
  const msg = ev.data as WorkerTaskMessage;
  if (!msg || msg.t !== 'task') return;
  void runTask(msg);
});

async function runTask(msg: WorkerTaskMessage): Promise<void> {
  const { id, file, opts, logo } = msg;
  try {
    if (!host.isOffscreen()) {
      throw new Error('Браузер не поддерживает OffscreenCanvas в воркерах — используйте Chrome/Edge/Firefox');
    }
    post({ t: 'progress', id, stage: 8 });
    const result = await processImage(file, opts, host, logo);
    post({ t: 'raw', id, bytes: result.rawBytes });
    post({ t: 'progress', id, stage: 92 });
    post({ t: 'done', id, result });
  } catch (e) {
    post({ t: 'error', id, message: e instanceof Error ? e.message : String(e) });
  }
}