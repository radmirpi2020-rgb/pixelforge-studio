import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import sveltePreprocess from 'svelte-preprocess';
import { VitePWA } from 'vite-plugin-pwa';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    svelte({ preprocess: sveltePreprocess() }),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'PixelForge Studio',
        short_name: 'PixelForge',
        description: 'Пакетная оптимизация изображений в браузере: без сервера и загрузок',
        theme_color: '#0d1017',
        background_color: '#0d1017',
        display: 'standalone',
        lang: 'ru',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024
      }
    })
  ],
  resolve: {
    alias: {
      html2canvas: path.join(root, 'src', 'stubs', 'html2canvas.ts'),
      dompurify: path.join(root, 'src', 'stubs', 'dompurify.ts'),
      canvg: path.join(root, 'src', 'stubs', 'canvg.ts')
    }
  },
  build: {
    target: 'es2022'
  },
  worker: {
    format: 'es',
    rollupOptions: {
      output: {
        inlineDynamicImports: true
      }
    }
  }
});