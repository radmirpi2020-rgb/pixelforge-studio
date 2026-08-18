import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 4174;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DL_DIR = 'C:\\Users\\1\\AppData\\Local\\Temp\\opencode\\pf_downloads_v3';
const SHOT = 'C:\\Users\\1\\AppData\\Local\\Temp\\opencode\\pf_v3.png';
fs.mkdirSync(DL_DIR, { recursive: true });
for (const f of fs.readdirSync(DL_DIR)) fs.rmSync(path.join(DL_DIR, f), { force: true });

function startPreview() {
  const child = spawn(
    process.execPath,
    [path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'],
    { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] }
  );
  child.stdout.on('data', () => undefined);
  child.stderr.on('data', () => undefined);
  return child;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitServer(url, timeout = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      // not yet
    }
    await wait(400);
  }
  throw new Error('Сервер не поднялся');
}

async function waitForPage(page, selector, timeout = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const found = await page.evaluate((sel) => document.querySelectorAll(sel).length, selector);
    if (found > 0) return;
    await wait(700);
  }
  throw new Error(`Таймаут ожидания селектора: ${selector}`);
}

const server = startPreview();
let browser;
try {
  await waitServer(`http://127.0.0.1:${PORT}/`);
  browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: true,
    args: ['--no-first-run', '--disable-gpu']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1500, height: 950 });
  const consoleErrors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));

  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle0', timeout: 30000 });

  const meta = await page.evaluate(async () => {
    const manifest = await fetch('/manifest.webmanifest').then((r) => r.json()).catch(() => null);
    const regs = await navigator.serviceWorker.getRegistrations();
    return {
      title: document.title,
      desc: document.querySelector('meta[name="description"]')?.getAttribute('content'),
      jsonld: document.querySelectorAll('script[type="application/ld+json"]').length,
      manifestName: manifest?.name,
      manifestIcons: manifest?.icons?.length,
      swCount: regs.length
    };
  });
  console.log('PWA/SEO:', JSON.stringify(meta));

  await page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = 1200;
    c.height = 900;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 1200, 900);
    g.addColorStop(0, '#2563eb');
    g.addColorStop(0.5, '#7c3aed');
    g.addColorStop(1, '#0ea5e9');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1200, 900);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 140px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('PixelForge', 600, 430);
    ctx.font = 'bold 42px Arial';
    ctx.fillText('E2E v3 smoke test', 600, 520);
    const blob = await new Promise((r) => c.toBlob((b) => r(b), 'image/jpeg', 0.95));
    const file = new File([blob], 'test_photo_gradient.jpg', { type: 'image/jpeg' });
    const dt = new DataTransfer();
    dt.items.add(file);
    const zone = document.querySelector('.drop');
    zone.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  });

  await waitForPage(page, '.badge.ok');
  await wait(500);
  await page.screenshot({ path: SHOT });

  const client = await page.createCDPSession();
  await client.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: DL_DIR });

  const clickBar = async (label) => {
    const handle = await page.evaluateHandle(
      (lbl) => Array.from(document.querySelectorAll('.bar button')).find((b) => b.textContent.includes(lbl)) ?? null,
      label
    );
    const el = handle.asElement();
    if (!el) throw new Error(`Кнопка не найдена: ${label}`);
    await el.click();
  };

  await clickBar('PDF-каталог');
  await wait(10000);
  await clickBar('CSV-отчёт');
  await wait(3000);

  const files = fs.readdirSync(DL_DIR).map((n) => {
    const buf = fs.readFileSync(path.join(DL_DIR, n));
    return { name: n, size: buf.length, sig: buf.length > 4 ? buf.subarray(0, 4).toString('latin1') : '' };
  });
  console.log('DOWNLOADS:', JSON.stringify(files));
  console.log('consoleErrors:', JSON.stringify(consoleErrors));
  console.log('SMOKE OK');
} finally {
  if (browser) await browser.close();
  server.kill();
}