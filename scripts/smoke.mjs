import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 4173;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DL_DIR = 'C:\\Users\\1\\AppData\\Local\\Temp\\opencode\\pf_downloads';

function startPreview() {
  const child = spawn(
    process.execPath,
    [path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'],
    { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] }
  );
  child.stdout.on('data', (d) => process.stdout.write(`[vite] ${d}`));
  child.stderr.on('data', (d) => process.stdout.write(`[vite:err] ${d}`));
  child.on('exit', (code) => console.log(`[vite] exited ${code}`));
  return child;
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

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
    if (found > 0) return true;
    await wait(700);
  }
  throw new Error(`Таймаут ожидания селектора: ${selector}`);
}

const server = startPreview();
let browser;
try {
  await waitServer(`http://localhost:${PORT}/`);
  browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: true,
    args: ['--no-first-run', '--disable-gpu']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const consoleErrors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));

  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle0' });

  const info = await page.evaluate(() => ({
    title: document.title,
    hasDropZone: !!document.querySelector('.drop'),
    presetChips: document.querySelectorAll('.chip').length
  }));
  console.log('UI:', JSON.stringify(info));

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
    ctx.fillText('E2E smoke test', 600, 520);
    const blob = await new Promise((r) => c.toBlob((b) => r(b), 'image/jpeg', 0.95));
    const file = new File([blob], 'test_photo_gradient.jpg', { type: 'image/jpeg' });
    const dt = new DataTransfer();
    dt.items.add(file);
    const zone = document.querySelector('.drop');
    zone.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  });

  try {
    await waitForPage(page, '.badge.ok');
  } catch (err) {
    const diag = await page.evaluate(() => ({
      rows: document.querySelectorAll('tbody tr').length,
      firstRow: document.querySelector('tbody tr')?.textContent ?? '',
      errTitle: document.querySelector('.badge.err')?.getAttribute('title') ?? '',
      errRowTitle: document.querySelector('tbody tr[class]')?.title ?? '',
      badges: Array.from(document.querySelectorAll('.badge')).map((b) => b.textContent.trim()),
      bar: Array.from(document.querySelectorAll('.bar')).map((b) => b.textContent.trim()),
      body: document.body.innerText.slice(0, 600)
    }));
    console.log('DIAG:', JSON.stringify(diag, null, 2));
    console.log('consoleErrors:', JSON.stringify(consoleErrors));
    throw err;
  }
  await wait(800);

  const row = await page.evaluate(() => {
    const tr = document.querySelector('tbody tr');
    const tds = tr ? Array.from(tr.querySelectorAll('td')).map((td) => td.textContent.trim()) : [];
    const badges = tr ? Array.from(tr.querySelectorAll('.badge')).map((b) => b.textContent.trim()) : [];
    return { cells: tds, badges, cls: tr ? tr.className : '' };
  });
  console.log('ROW:', JSON.stringify(row));

  const eyes = await page.$$('button[title="Сравнить До/После"]');
  if (eyes.length > 0) {
    await eyes[0].click();
    await waitForPage(page, '.divider');
    await wait(800);
    const cmp = await page.evaluate(() => {
      const imgs = document.querySelectorAll('.stage img');
      const filled = [];
      imgs.forEach((i) => filled.push(`${i.alt}:${i.naturalWidth}x${i.naturalHeight}`));
      return {
        imgs: filled,
        metrics: Array.from(document.querySelectorAll('.m')).map((m) => m.textContent.trim().replace(/\s+/g, ' ')),
        tags: Array.from(document.querySelectorAll('.tag')).map((t) => t.textContent.trim())
      };
    });
    console.log('COMPARE:', JSON.stringify(cmp));
    await page.locator('.modal header button').click();
    await wait(400);
  }

  const barBtns = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.bar button')).map((b) => b.textContent.trim())
  );
  console.log('BAR:', JSON.stringify(barBtns));

  const zipHandle = await page.evaluateHandle(() => {
    const btns = Array.from(document.querySelectorAll('.bar button'));
    return btns.find((b) => b.textContent.includes('Скачать ZIP')) ?? null;
  });
  const zipEl = zipHandle.asElement();
  if (zipEl) {
    const client = await page.createCDPSession();
    await client.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: DL_DIR });
    await zipEl.click();
    await wait(7000);
  }

  console.log('consoleErrors:', JSON.stringify(consoleErrors));
  console.log('SMOKE OK');
} finally {
  if (browser) await browser.close();
  server.kill();
}