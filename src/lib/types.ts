export type SupportedOutputFormat = 'jpeg' | 'png' | 'webp' | 'avif';

export type FitMode = 'NONE' | 'CONTAIN' | 'COVER' | 'EXACT' | 'SCALE_WIDTH' | 'SCALE_HEIGHT';

export type WatermarkPosition =
  | 'CENTER'
  | 'TOP_LEFT'
  | 'TOP_RIGHT'
  | 'BOTTOM_LEFT'
  | 'BOTTOM_RIGHT'
  | 'TILED_DIAGONAL';

export type WatermarkType = 'TEXT' | 'IMAGE';

export interface WatermarkConfig {
  type: WatermarkType;
  text?: string;
  fontFamily?: string;
  fontSizePercent: number;
  colorHex: string;
  opacity: number;
  imageBlob?: File;
  position: WatermarkPosition;
  paddingPx: number;
  rotationDegrees: number;
}

export interface ProcessingOptions {
  outputFormat: SupportedOutputFormat;
  quality: number;
  fitMode: FitMode;
  targetWidth?: number;
  targetHeight?: number;
  maintainAspectRatio: boolean;
  stripMetadata: boolean;
  backgroundPaddingColor: string;
  watermark?: WatermarkConfig;
  outputNameTemplate: string;
  sharpen: number;
}

export interface ImageTaskMetric {
  originalSize: number;
  processedSize: number;
  compressionRatio: number;
  processingTimeMs: number;
  ssimScore?: number;
  psnrDb?: number;
  fallbackFormat?: boolean;
  outWidth?: number;
  outHeight?: number;
}

export type TaskStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'ERROR' | 'CANCELLED';

export interface ImageTask {
  id: string;
  file: File;
  relativePath?: string;
  previewUrl: string;
  originalWidth: number;
  originalHeight: number;
  status: TaskStatus;
  progress: number;
  errorMessage?: string;
  resultBlob?: Blob;
  metrics?: ImageTaskMetric;
  customOverrides?: Partial<ProcessingOptions>;
  artifactRisk?: boolean;
}

export interface MarketplacePreset {
  id: string;
  name: string;
  icon: string;
  description: string;
  options: ProcessingOptions;
  builtin?: boolean;
}

export interface AppSettings {
  threads: number;
  memoryGateMb: number;
}

export interface WorkerResult {
  blob: Blob;
  width: number;
  height: number;
  ssim?: number;
  psnr?: number;
  fallbackFormat: boolean;
  rawBytes: number;
  processingTimeMs: number;
}

export interface WorkerTaskMessage {
  t: 'task';
  id: string;
  file: File;
  opts: ProcessingOptions;
  logo?: File;
}

export type WorkerOutMessage =
  | { t: 'progress'; id: string; stage: number }
  | { t: 'raw'; id: string; bytes: number }
  | { t: 'done'; id: string; result: WorkerResult }
  | { t: 'error'; id: string; message: string };