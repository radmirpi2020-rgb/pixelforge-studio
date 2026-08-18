import type { ProcessingOptions, WatermarkConfig, WorkerResult } from './types';
import { stripMetadata } from './metadata';
import { computeQualityMetrics } from './ssim';
import type { CanvasHost, Ctx2d, HostCanvas } from './canvasHost';
import { CanvasUnavailableError } from './canvasHost';

export interface FitPlan {
  canvasW: number;
  canvasH: number;
  drawW: number;
  drawH: number;
  drawX: number;
  drawY: number;
  bgMode: 'none' | 'solid' | 'blur';
}

export function planFit(opts: ProcessingOptions, sw: number, sh: number): FitPlan {
  const tw = opts.targetWidth;
  const th = opts.targetHeight;
  if (!tw || !th) {
    const w = tw && tw > 0 ? tw : sw;
    const h = th && th > 0 ? th : sh;
    return { canvasW: w, canvasH: h, drawW: w, drawH: h, drawX: 0, drawY: 0, bgMode: 'none' };
  }
  switch (opts.fitMode) {
    case 'NONE':
      return { canvasW: sw, canvasH: sh, drawW: sw, drawH: sh, drawX: 0, drawY: 0, bgMode: 'none' };
    case 'SCALE_WIDTH': {
      const h = Math.max(1, Math.round((sh * tw) / sw));
      return { canvasW: tw, canvasH: h, drawW: tw, drawH: h, drawX: 0, drawY: 0, bgMode: 'none' };
    }
    case 'SCALE_HEIGHT': {
      const w = Math.max(1, Math.round((sw * th) / sh));
      return { canvasW: w, canvasH: th, drawW: w, drawH: th, drawX: 0, drawY: 0, bgMode: 'none' };
    }
    case 'EXACT':
      return { canvasW: tw, canvasH: th, drawW: tw, drawH: th, drawX: 0, drawY: 0, bgMode: 'none' };
    case 'COVER': {
      const s = Math.max(tw / sw, th / sh);
      const dw = Math.round(sw * s);
      const dh = Math.round(sh * s);
      return {
        canvasW: tw,
        canvasH: th,
        drawW: dw,
        drawH: dh,
        drawX: Math.round((tw - dw) / 2),
        drawY: Math.round((th - dh) / 2),
        bgMode: 'none'
      };
    }
    case 'CONTAIN': {
      if (!opts.maintainAspectRatio) {
        return { canvasW: tw, canvasH: th, drawW: tw, drawH: th, drawX: 0, drawY: 0, bgMode: 'none' };
      }
      const s = Math.min(tw / sw, th / sh);
      const dw = Math.max(1, Math.round(sw * s));
      const dh = Math.max(1, Math.round(sh * s));
      const bgMode: FitPlan['bgMode'] = opts.backgroundPaddingColor === 'BLUR_PAD' ? 'blur' : 'solid';
      return {
        canvasW: tw,
        canvasH: th,
        drawW: dw,
        drawH: dh,
        drawX: Math.round((tw - dw) / 2),
        drawY: Math.round((th - dh) / 2),
        bgMode
      };
    }
  }
}

function toSource(c: ImageBitmap | HostCanvas): CanvasImageSource {
  return ('raw' in c ? c.raw : c) as CanvasImageSource;
}

export async function processImage(
  file: File,
  opts: ProcessingOptions,
  host: CanvasHost,
  logoFile?: File
): Promise<WorkerResult> {
  if (!host.isOffscreen()) {
    throw new CanvasUnavailableError('OffscreenCanvas недоступен в этом потоке');
  }
  const t0 = performance.now();
  const buf = await file.arrayBuffer();
  const clean = opts.stripMetadata ? stripMetadata(buf, file.type) : buf;
  const bmp = await createImageBitmap(new Blob([clean], { type: file.type }), {
    imageOrientation: 'none'
  });
  const rawBytes = bmp.width * bmp.height * 4;
  const plan = planFit(opts, bmp.width, bmp.height);
  const canvas = host.create(plan.canvasW, plan.canvasH);
  const ctx = canvas.getContext2d();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const padColor =
    opts.backgroundPaddingColor === 'BLUR_PAD'
      ? '#000000'
      : /^#[0-9a-fA-F]{3,8}$/.test(opts.backgroundPaddingColor)
        ? opts.backgroundPaddingColor
        : '#FFFFFF';

  if (plan.bgMode === 'solid') {
    ctx.fillStyle = padColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  if (plan.bgMode === 'blur') {
    const bg = host.create(plan.canvasW, plan.canvasH);
    const bctx = bg.getContext2d();
    bctx.imageSmoothingEnabled = true;
    bctx.imageSmoothingQuality = 'high';
    const s = Math.max(plan.canvasW / bmp.width, plan.canvasH / bmp.height);
    const bw = Math.round(bmp.width * s);
    const bh = Math.round(bmp.height * s);
    bctx.drawImage(bmp, Math.round((plan.canvasW - bw) / 2), Math.round((plan.canvasH - bh) / 2), bw, bh);
    bctx.filter = 'blur(40px) brightness(0.85)';
    bctx.drawImage(bg.raw, 0, 0);
    ctx.drawImage(bg.raw, 0, 0);
  }

  if (
    opts.outputFormat === 'jpeg' &&
    plan.bgMode === 'none' &&
    plan.canvasW === plan.drawW &&
    plan.canvasH === plan.drawH &&
    plan.drawX === 0 &&
    plan.drawY === 0
  ) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  const drawable = await stepResize(bmp, plan.drawW, plan.drawH, host);

  if (plan.bgMode === 'blur') {
    ctx.shadowColor = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur = 20;
  }
  ctx.drawImage(toSource(drawable), plan.drawX, plan.drawY, plan.drawW, plan.drawH);
  ctx.shadowBlur = 0;

  if (
    opts.watermark &&
    (opts.watermark.type === 'TEXT' ? opts.watermark.text : opts.watermark.imageBlob)
  ) {
    await applyWatermark(ctx, canvas, opts.watermark, logoFile);
  }

  if (opts.sharpen > 0) applyUnsharp(canvas, opts.sharpen);

  let mime = 'image/' + opts.outputFormat;
  let fallbackFormat = false;
  if (opts.outputFormat === 'avif' && !(await host.isAvifSupported())) {
    mime = 'image/webp';
    fallbackFormat = true;
  }
  const quality = mime === 'image/png' ? undefined : opts.quality / 100;
  const blob = await host.toBlob(canvas, mime, quality);

  let ssim: number | undefined;
  let psnr: number | undefined;
  try {
    const outBmp = await createImageBitmap(blob);
    const m = await computeQualityMetrics(bmp, outBmp, host);
    ssim = m.ssim;
    psnr = m.psnr;
    outBmp.close();
  } catch {
    // SSIM недоступен — не критично
  }
  try {
    bmp.close();
  } catch {
    // уже закрыт
  }

  const processingTimeMs = performance.now() - t0;
  return {
    blob,
    width: canvas.width,
    height: canvas.height,
    ssim,
    psnr,
    fallbackFormat,
    rawBytes,
    processingTimeMs
  };
}

async function stepResize(
  bmp: ImageBitmap,
  dw: number,
  dh: number,
  host: CanvasHost
): Promise<ImageBitmap | HostCanvas> {
  if (dw === bmp.width && dh === bmp.height) return bmp;
  let cur: ImageBitmap | HostCanvas = bmp;
  let cw = bmp.width;
  let ch = bmp.height;
  if (dw < cw || dh < ch) {
    while (cw > dw * 2 || ch > dh * 2) {
      const nw = Math.max(dw, Math.ceil(cw / 2));
      const nh = Math.max(dh, Math.ceil(ch / 2));
      if (nw === cw && nh === ch) break;
      const step = host.create(nw, nh);
      const s = step.getContext2d();
      s.imageSmoothingEnabled = true;
      s.imageSmoothingQuality = 'high';
      s.drawImage(toSource(cur), 0, 0, nw, nh);
      cur = step;
      cw = nw;
      ch = nh;
    }
  }
  if (cw !== dw || ch !== dh) {
    const fin = host.create(dw, dh);
    const f = fin.getContext2d();
    f.imageSmoothingEnabled = true;
    f.imageSmoothingQuality = 'high';
    f.drawImage(toSource(cur), 0, 0, dw, dh);
    cur = fin;
  }
  return cur;
}

function safeFont(family: string | undefined): string {
  return (family || 'Arial').replace(/["';\\]/g, '');
}

function textAnchor(
  pos: WatermarkConfig['position'],
  w: number,
  h: number,
  tw: number,
  th: number,
  pad: number
): { x: number; y: number } {
  const m = Math.max(8, pad);
  switch (pos) {
    case 'TOP_LEFT':
      return { x: m + tw / 2, y: m + th / 2 };
    case 'TOP_RIGHT':
      return { x: w - m - tw / 2, y: m + th / 2 };
    case 'BOTTOM_LEFT':
      return { x: m + tw / 2, y: h - m - th / 2 };
    case 'BOTTOM_RIGHT':
      return { x: w - m - tw / 2, y: h - m - th / 2 };
    default:
      return { x: w / 2, y: h / 2 };
  }
}

function imgAnchor(
  pos: WatermarkConfig['position'],
  w: number,
  h: number,
  iw: number,
  ih: number,
  pad: number
): { x: number; y: number } {
  const m = Math.max(8, pad);
  switch (pos) {
    case 'TOP_LEFT':
      return { x: m, y: m };
    case 'TOP_RIGHT':
      return { x: w - m - iw, y: m };
    case 'BOTTOM_LEFT':
      return { x: m, y: h - m - ih };
    case 'BOTTOM_RIGHT':
      return { x: w - m - iw, y: h - m - ih };
    default:
      return { x: (w - iw) / 2, y: (h - ih) / 2 };
  }
}

async function applyWatermark(
  ctx: Ctx2d,
  c: HostCanvas,
  wm: WatermarkConfig,
  logoFile?: File
): Promise<void> {
  ctx.save();
  ctx.globalAlpha = Math.min(1, Math.max(0, wm.opacity));
  const fraction = wm.fontSizePercent / 100;
  const tiled = wm.position === 'TILED_DIAGONAL';

  if (wm.type === 'TEXT' && wm.text) {
    const fontSize = Math.max(8, Math.round(fraction * c.height));
    ctx.font = `${fontSize}px ${safeFont(wm.fontFamily)}`;
    ctx.fillStyle = wm.colorHex;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    const pad = wm.paddingPx;
    const tw = ctx.measureText(wm.text).width;
    const th = fontSize;
    if (tiled) {
      ctx.translate(c.width / 2, c.height / 2);
      ctx.rotate((wm.rotationDegrees * Math.PI) / 180);
      ctx.translate(-c.width / 2, -c.height / 2);
      const stepX = c.width / 3;
      const stepY = c.height / 3;
      const ext = Math.ceil(Math.hypot(c.width, c.height));
      for (let y = -ext; y <= c.height + ext; y += stepY) {
        for (let x = -ext; x <= c.width + ext; x += stepX) {
          ctx.fillText(wm.text, x, y);
        }
      }
    } else {
      const p = textAnchor(wm.position, c.width, c.height, tw, th, pad);
      ctx.fillText(wm.text, p.x, p.y);
    }
  } else if (wm.type === 'IMAGE' && logoFile) {
    const logo = await createImageBitmap(logoFile);
    const lh = Math.max(2, Math.round(fraction * c.height));
    const lw = Math.max(2, Math.round((logo.width * lh) / Math.max(1, logo.height)));
    if (tiled) {
      ctx.translate(c.width / 2, c.height / 2);
      ctx.rotate((wm.rotationDegrees * Math.PI) / 180);
      ctx.translate(-c.width / 2, -c.height / 2);
      const stepX = c.width / 3;
      const stepY = c.height / 3;
      const ext = Math.ceil(Math.hypot(c.width, c.height));
      for (let y = -ext; y <= c.height + ext; y += stepY) {
        for (let x = -ext; x <= c.width + ext; x += stepX) {
          ctx.drawImage(logo, x - lw / 2, y - lh / 2, lw, lh);
        }
      }
    } else {
      const p = imgAnchor(wm.position, c.width, c.height, lw, lh, wm.paddingPx);
      ctx.drawImage(logo, Math.round(p.x), Math.round(p.y), lw, lh);
    }
    logo.close();
  }
  ctx.restore();
}

export function applyUnsharp(c: HostCanvas, amount: number): void {
  const ctx = c.getContext2d();
  const w = c.width;
  const h = c.height;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const src = new Float32Array(d);
  const a = Math.min(1.5, Math.max(0, amount));
  const kc = 1 + a;
  const ko = -a / 8;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      for (let ch = 0; ch < 3; ch++) {
        let s = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            const yy = y + dy;
            const px = xx < 0 ? 0 : xx >= w ? w - 1 : xx;
            const py = yy < 0 ? 0 : yy >= h ? h - 1 : yy;
            const wgt = dx === 0 && dy === 0 ? kc : ko;
            s += src[(py * w + px) * 4 + ch] * wgt;
          }
        }
        d[idx + ch] = s < 0 ? 0 : s > 255 ? 255 : s;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
}