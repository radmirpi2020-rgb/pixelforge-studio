import puppeteer from 'puppeteer-core';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const SRC = path.join(PUBLIC, 'icon.svg');

try {
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: true,
    args: ['--no-first-run', '--disable-gpu', '--allow-file-access-from-files']
  });
  const page = await browser.newPage();
  for (const size of [192, 512]) {
    await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
    await page.goto(`file:///${SRC.replace(/\\/g, '/')}`, { waitUntil: 'networkidle0' });
    const out = path.join(PUBLIC, `icon-${size}.png`);
    await page.screenshot({ path: out });
    console.log(`icon-${size}.png создан (${fs.statSync(out).size} байт)`);
  }
  await browser.close();
} catch (e) {
  console.error('Ошибка генерации иконок:', e);
  process.exit(1);
}