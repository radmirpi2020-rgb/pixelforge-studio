import { jsPDF } from 'jspdf';

interface PdfRequest {
  t: 'build';
  title: string;
  items: { name: string; blob: Blob }[];
}

interface PdfResult {
  t: 'pdf';
  blob: Blob;
  pages: number;
  count: number;
}

addEventListener('message', async (ev: MessageEvent) => {
  const data = ev.data as PdfRequest;
  if (!data || data.t !== 'build') return;
  try {
    const result = await buildPdf(data);
    (self as unknown as Worker).postMessage(result);
  } catch (e) {
    (self as unknown as Worker).postMessage({
      t: 'error',
      message: e instanceof Error ? e.message : String(e)
    });
  }
});

async function buildPdf(req: PdfRequest): Promise<PdfResult> {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const W = 595.28;
  const H = 841.89;
  const M = 34;
  const titleH = 52;
  const cols = 3;
  const rows = 3;
  const cellW = (W - M * 2) / cols;
  const cellH = (H - M * 2 - titleH) / rows;
  const capH = 26;
  const imgBoxW = cellW - 14;
  const imgBoxH = cellH - 14 - capH;

  let page = 0;

  for (let i = 0; i < req.items.length; i++) {
    const cell = i % (cols * rows);
    if (cell === 0) {
      if (page > 0) pdf.addPage();
      page++;
      pdf.setFontSize(15);
      pdf.setTextColor(24);
      pdf.text(req.title, M, M + 20);
      pdf.setFontSize(8.5);
      pdf.setTextColor(110);
      const today = new Date().toLocaleDateString('ru-RU');
      pdf.text(`Сгенерировано PixelForge Studio · ${today}`, M, M + 34);
      pdf.setDrawColor(210, 214, 222);
      pdf.line(M, M + titleH - 8, W - M, M + titleH - 8);
    }

    const it = req.items[i];
    const col = cell % cols;
    const row = Math.floor(cell / cols);
    const x = M + col * cellW;
    const y = M + titleH + row * cellH;

    pdf.setDrawColor(210, 214, 222);
    pdf.setLineWidth(0.7);
    pdf.rect(x, y, cellW, cellH);

    const jpeg = await toJpeg(it.blob);
    const scale = Math.min(imgBoxW / jpeg.w, imgBoxH / jpeg.h, 1);
    const dw = jpeg.w * scale;
    const dh = jpeg.h * scale;
    const dx = x + (cellW - dw) / 2;
    const dy = y + 7;
    pdf.addImage(jpeg.data, 'JPEG', dx, dy, dw, dh, undefined, 'FAST');

    pdf.setFontSize(8.5);
    pdf.setTextColor(60);
    pdf.setFont('helvetica', 'bold');
    const name = truncate(it.name, 44);
    pdf.text(name, x + 7, y + cellH - 12);
    pdf.setFont('helvetica', 'normal');
    const dims = `${jpeg.w}×${jpeg.h}`;
    pdf.text(dims, x + cellW - 7, y + cellH - 12, { align: 'right' });
  }

  const blob = pdf.output('blob');
  return { t: 'pdf', blob, pages: page, count: req.items.length };
}

async function toJpeg(
  blob: Blob
): Promise<{ data: Uint8Array; w: number; h: number }> {
  const bmp = await createImageBitmap(blob);
  const max = 720;
  const sc = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * sc));
  const h = Math.max(1, Math.round(bmp.height * sc));
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D-контекст недоступен');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const jpegBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.86 });
  return { data: new Uint8Array(await jpegBlob.arrayBuffer()), w, h };
}

function truncate(s: string, n: number): string {
  const single = s.replace(/\s+/g, ' ').trim();
  return single.length > n ? single.slice(0, n - 1) + '…' : single;
}