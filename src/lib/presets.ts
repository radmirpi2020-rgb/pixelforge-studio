import type { MarketplacePreset, ProcessingOptions, WatermarkConfig } from './types';

export function makeWatermark(): WatermarkConfig {
  return {
    type: 'TEXT',
    text: 'PixelForge',
    fontFamily: 'Arial',
    fontSizePercent: 6,
    colorHex: '#FFFFFF',
    opacity: 0.35,
    position: 'BOTTOM_RIGHT',
    paddingPx: 24,
    rotationDegrees: -30
  };
}

export const BASE_OPTIONS: ProcessingOptions = {
  outputFormat: 'webp',
  quality: 85,
  fitMode: 'CONTAIN',
  maintainAspectRatio: true,
  stripMetadata: true,
  backgroundPaddingColor: '#FFFFFF',
  outputNameTemplate: '{name}_compressed_{w}x{h}',
  sharpen: 0
};

export const MARKETPLACE_PRESETS: MarketplacePreset[] = [
  {
    id: 'wb-catalog',
    name: 'Wildberries Каталог',
    icon: 'wb',
    description: '900×1200 · WebP 85% · размытый фон',
    builtin: true,
    options: {
      ...BASE_OPTIONS,
      outputFormat: 'webp',
      quality: 85,
      fitMode: 'CONTAIN',
      targetWidth: 900,
      targetHeight: 1200,
      backgroundPaddingColor: 'BLUR_PAD'
    }
  },
  {
    id: 'ozon-main',
    name: 'Ozon Главное фото',
    icon: 'oz',
    description: '1200×1200 · JPG 90% · белый фон',
    builtin: true,
    options: {
      ...BASE_OPTIONS,
      outputFormat: 'jpeg',
      quality: 90,
      fitMode: 'CONTAIN',
      targetWidth: 1200,
      targetHeight: 1200,
      backgroundPaddingColor: '#FFFFFF'
    }
  },
  {
    id: 'avito',
    name: 'Avito Премиум',
    icon: 'av',
    description: '1280×960 · JPG 85%',
    builtin: true,
    options: {
      ...BASE_OPTIONS,
      outputFormat: 'jpeg',
      quality: 85,
      fitMode: 'CONTAIN',
      targetWidth: 1280,
      targetHeight: 960,
      backgroundPaddingColor: '#FFFFFF'
    }
  },
  {
    id: 'yandex',
    name: 'Яндекс Маркет',
    icon: 'ym',
    description: '1000×1000 · JPG 88% · белый фон',
    builtin: true,
    options: {
      ...BASE_OPTIONS,
      outputFormat: 'jpeg',
      quality: 88,
      fitMode: 'CONTAIN',
      targetWidth: 1000,
      targetHeight: 1000,
      backgroundPaddingColor: '#FFFFFF'
    }
  },
  {
    id: 'web-opt',
    name: 'Web Оптимизация',
    icon: 'web',
    description: 'WebP 80% · без ресайза · EXIF off',
    builtin: true,
    options: {
      ...BASE_OPTIONS,
      outputFormat: 'webp',
      quality: 80,
      fitMode: 'NONE',
      stripMetadata: true
    }
  }
];

export function describePresetOptions(o: ProcessingOptions): string {
  const size =
    o.fitMode === 'NONE'
      ? 'без ресайза'
      : o.targetWidth && o.targetHeight
        ? `${o.targetWidth}×${o.targetHeight}`
        : 'пропорционально';
  return `${size} · ${o.outputFormat.toUpperCase()}${o.outputFormat === 'png' ? '' : ` ${o.quality}%`}`;
}