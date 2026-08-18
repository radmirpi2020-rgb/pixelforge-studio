export type Ctx2d = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export type RawCanvas = HTMLCanvasElement | OffscreenCanvas;

export interface HostCanvas {
  readonly width: number;
  readonly height: number;
  raw: RawCanvas;
  getContext2d(): Ctx2d;
}

export interface CanvasHost {
  create(w: number, h: number): HostCanvas;
  toBlob(c: HostCanvas, type: string, quality: number | undefined): Promise<Blob>;
  isAvifSupported(): Promise<boolean>;
  isOffscreen(): boolean;
}

export class CanvasUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CanvasUnavailableError';
  }
}

class OffscreenCanvasAdapter implements HostCanvas {
  readonly raw: OffscreenCanvas;

  constructor(w: number, h: number) {
    this.raw = new OffscreenCanvas(w, h);
  }

  get width(): number {
    return this.raw.width;
  }

  get height(): number {
    return this.raw.height;
  }

  getContext2d(): Ctx2d {
    const ctx = this.raw.getContext('2d');
    if (!ctx) throw new Error('2D-контекст OffscreenCanvas недоступен');
    return ctx;
  }
}

class HtmlCanvasAdapter implements HostCanvas {
  readonly raw: HTMLCanvasElement;

  constructor(w: number, h: number) {
    this.raw = document.createElement('canvas');
    this.raw.width = w;
    this.raw.height = h;
  }

  get width(): number {
    return this.raw.width;
  }

  get height(): number {
    return this.raw.height;
  }

  getContext2d(): Ctx2d {
    const ctx = this.raw.getContext('2d');
    if (!ctx) throw new Error('2D-контекст недоступен');
    return ctx;
  }
}

export class WorkerCanvasHost implements CanvasHost {
  private avif: boolean | null = null;

  isOffscreen(): boolean {
    return typeof OffscreenCanvas !== 'undefined';
  }

  create(w: number, h: number): HostCanvas {
    return new OffscreenCanvasAdapter(w, h);
  }

  async toBlob(c: HostCanvas, type: string, quality: number | undefined): Promise<Blob> {
    const oc = c.raw as OffscreenCanvas;
    return oc.convertToBlob({ type, quality });
  }

  async isAvifSupported(): Promise<boolean> {
    if (this.avif !== null) return this.avif;
    try {
      const cv = new OffscreenCanvas(4, 4);
      const ctx = cv.getContext('2d');
      if (!ctx) {
        this.avif = false;
        return false;
      }
      const b = await cv.convertToBlob({ type: 'image/avif', quality: 0.5 });
      this.avif = !!(b && b.size > 0);
    } catch {
      this.avif = false;
    }
    return this.avif;
  }
}

export class DomCanvasHost implements CanvasHost {
  private avif: boolean | null = null;

  isOffscreen(): boolean {
    return false;
  }

  create(w: number, h: number): HostCanvas {
    return new HtmlCanvasAdapter(w, h);
  }

  toBlob(c: HostCanvas, type: string, quality: number | undefined): Promise<Blob> {
    return new Promise((resolve, reject) => {
      (c.raw as HTMLCanvasElement).toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Не удалось закодировать кадр'))),
        type,
        quality
      );
    });
  }

  async isAvifSupported(): Promise<boolean> {
    if (this.avif !== null) return this.avif;
    const cv = document.createElement('canvas');
    cv.width = 4;
    cv.height = 4;
    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        cv.toBlob((b) => resolve(b), 'image/avif', 0.5)
      );
      this.avif = !!(blob && blob.size > 0);
    } catch {
      this.avif = false;
    }
    return this.avif;
  }
}