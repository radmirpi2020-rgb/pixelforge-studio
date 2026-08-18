import type { CanvasHost } from './canvasHost';

export interface QualityMetrics {
  ssim: number;
  psnr: number;
}

const WIN = 8;
const STEP = 4;
const SIGMA = 1.5;
const C1 = (0.01 * 255) ** 2;
const C2 = (0.03 * 255) ** 2;

export async function computeQualityMetrics(
  a: ImageBitmap,
  b: ImageBitmap,
  host: CanvasHost
): Promise<QualityMetrics> {
  const MAX = 160;
  const scale = Math.min(1, MAX / Math.max(a.width, a.height));
  const w = Math.max(1, Math.round(a.width * scale));
  const h = Math.max(1, Math.round(a.height * scale));
  const ga = await grayOf(a, host, w, h);
  const gb = await grayOf(b, host, w, h);
  const ssim = ssimIndex(ga, gb, w, h);
  const psnr = psnrOf(ga, gb);
  return { ssim, psnr };
}

async function grayOf(bmp: ImageBitmap, host: CanvasHost, w: number, h: number): Promise<Float32Array> {
  const c = host.create(w, h);
  const ctx = c.getContext2d();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  const g = new Float32Array(w * h);
  for (let i = 0, k = 0; i < data.length; i += 4, k++) {
    g[k] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return g;
}

function gaussianWeights(): Float32Array {
  const rad = (WIN - 1) / 2;
  const w = new Float32Array(WIN * WIN);
  let sum = 0;
  for (let y = 0; y < WIN; y++) {
    for (let x = 0; x < WIN; x++) {
      const dx = x - rad;
      const dy = y - rad;
      const v = Math.exp(-(dx * dx + dy * dy) / (2 * SIGMA * SIGMA));
      w[y * WIN + x] = v;
      sum += v;
    }
  }
  for (let k = 0; k < w.length; k++) w[k] /= sum;
  return w;
}

function ssimIndex(a: Float32Array, b: Float32Array, w: number, h: number): number {
  const weights = gaussianWeights();
  let total = 0;
  let count = 0;
  for (let y = 0; y <= h - WIN; y += STEP) {
    for (let x = 0; x <= w - WIN; x += STEP) {
      let muA = 0;
      let muB = 0;
      for (let wy = 0; wy < WIN; wy++) {
        for (let wx = 0; wx < WIN; wx++) {
          const idx = (y + wy) * w + (x + wx);
          const wgt = weights[wy * WIN + wx];
          muA += wgt * a[idx];
          muB += wgt * b[idx];
        }
      }
      let sA2 = 0;
      let sB2 = 0;
      let sAB = 0;
      for (let wy = 0; wy < WIN; wy++) {
        for (let wx = 0; wx < WIN; wx++) {
          const idx = (y + wy) * w + (x + wx);
          const wgt = weights[wy * WIN + wx];
          const da = a[idx] - muA;
          const db = b[idx] - muB;
          sA2 += wgt * da * da;
          sB2 += wgt * db * db;
          sAB += wgt * da * db;
        }
      }
      total +=
        ((2 * muA * muB + C1) * (2 * sAB + C2)) /
        (muA * muA + muB * muB + C1) /
        (sA2 + sB2 + C2);
      count++;
    }
  }
  return count ? total / count : 0;
}

function psnrOf(a: Float32Array, b: Float32Array): number {
  let mse = 0;
  for (let k = 0; k < a.length; k++) {
    const d = a[k] - b[k];
    mse += d * d;
  }
  mse /= a.length;
  if (mse === 0) return 99;
  return 10 * Math.log10((255 * 255) / mse);
}