const STRIP_JPEG_MARKERS = new Set([0xe1, 0xe2, 0xed]);

export function stripMetadata(buf: ArrayBuffer, mime: string): ArrayBuffer {
  if (mime === 'image/jpeg') return stripJpeg(buf);
  if (mime === 'image/png') return stripPng(buf);
  return buf;
}

function stripJpeg(buf: ArrayBuffer): ArrayBuffer {
  const src = new Uint8Array(buf);
  if (src.length < 4 || src[0] !== 0xff || src[1] !== 0xd8) return buf;
  const out: number[] = [0xff, 0xd8];
  let i = 2;
  while (i < src.length) {
    if (src[i] !== 0xff) {
      i++;
      continue;
    }
    while (i < src.length && src[i] === 0xff) i++;
    if (i >= src.length) break;
    const marker = src[i];
    i++;
    if (marker === 0xd9) {
      out.push(0xff, 0xd9);
      break;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      out.push(0xff, marker);
      continue;
    }
    if (i + 2 > src.length) break;
    const len = (src[i] << 8) | src[i + 1];
    if (len < 2) break;
    const keep = marker === 0xda || !STRIP_JPEG_MARKERS.has(marker);
    if (keep) {
      out.push(0xff, marker);
      for (let k = 0; k < len; k++) out.push(src[i + k]);
    }
    i += len;
    if (marker === 0xda) {
      for (let k = i; k < src.length; k++) out.push(src[k]);
      break;
    }
  }
  return new Uint8Array(out).buffer;
}

const STRIP_PNG_CHUNKS = new Set(['eXIf', 'tEXt', 'iTXt', 'zTXt']);

function stripPng(buf: ArrayBuffer): ArrayBuffer {
  const src = new Uint8Array(buf);
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let k = 0; k < sig.length; k++) {
    if (src[k] !== sig[k]) return buf;
  }
  if (src.length < 12) return buf;
  const out: number[] = [];
  for (let k = 0; k < 8; k++) out.push(src[k]);
  let i = 8;
  while (i + 12 <= src.length) {
    const len =
      (src[i] << 24) | (src[i + 1] << 16) | (src[i + 2] << 8) | src[i + 3];
    if (len < 0 || i + 12 + len > src.length) break;
    const type = String.fromCharCode(src[i + 4], src[i + 5], src[i + 6], src[i + 7]);
    if (!STRIP_PNG_CHUNKS.has(type)) {
      for (let k = 0; k < 12 + len; k++) out.push(src[i + k]);
    }
    i += 12 + len;
  }
  return new Uint8Array(out).buffer;
}