import { zipSync } from 'fflate';

interface ZipItem {
  name: string;
  blob: Blob;
}

addEventListener('message', (ev: MessageEvent) => {
  const data = ev.data;
  if (!data || data.t !== 'build') return;
  void build(data.items as ZipItem[]);
});

async function build(items: ZipItem[]): Promise<void> {
  const files: Record<string, Uint8Array> = {};
  for (const it of items) {
    files[it.name] = new Uint8Array(await it.blob.arrayBuffer());
  }
  const zipped = zipSync(files, { level: 6 });
  const blob = new Blob([zipped], { type: 'application/zip' });
  (self as unknown as Worker).postMessage({ t: 'zip', blob });
}