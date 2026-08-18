<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import DropZone from './components/DropZone.svelte';
  import OptionsPanel from './components/OptionsPanel.svelte';
  import TaskTable from './components/TaskTable.svelte';
  import CompareModal from './components/CompareModal.svelte';
  import SettingsModal from './components/SettingsModal.svelte';
import {
  initQueue,
  addFiles,
  clearAll,
  downloadZipAll,
  saveToFolderAll,
  downloadPdfAll,
  exportCsvReport
} from './lib/queue';
  import { stats, settings, comparator, busyZip, busyPdf, showSettings, pushToast, tasks, toasts, liveThreads } from './lib/store';
  import { fmtBytes, fmtSaving } from './lib/format';

  let fileInputEl: HTMLInputElement;
  let reportedDone = false;
  let installEvent: Event | null = null;
  let appInstalled = false;

  onMount(() => {
    initQueue();
    window.addEventListener('paste', onPaste);
    window.addEventListener('beforeinstallprompt', onInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
  });

  onDestroy(() => {
    window.removeEventListener('paste', onPaste);
    window.removeEventListener('beforeinstallprompt', onInstallPrompt);
    window.removeEventListener('appinstalled', onAppInstalled);
  });

  function onInstallPrompt(e: Event) {
    e.preventDefault();
    installEvent = e;
  }

  function onAppInstalled() {
    installEvent = null;
    appInstalled = true;
  }

  async function installApp() {
    const ev = installEvent as { prompt: () => Promise<void> } | null;
    if (!ev) return;
    await ev.prompt();
    installEvent = null;
  }

  function onPaste(e: ClipboardEvent) {
    const files = e.clipboardData?.files;
    if (files && files.length) void addFiles(Array.from(files));
  }

  async function onChangePick() {
    const f = fileInputEl.files;
    if (f?.length) await addFiles(Array.from(f));
    fileInputEl.value = '';
  }

  $: threads = $settings.threads > 0 ? $settings.threads : $liveThreads;

  $: {
    const s = $stats;
    if (s.total && s.done === s.total && !s.processing && s.done > 0) {
      if (!reportedDone) {
        reportedDone = true;
        pushToast(`Готово: ${s.done} файлов, экономия ${fmtSaving(s.savings)}`, 'ok', 6000);
      }
    } else {
      reportedDone = false;
    }
  }
</script>

<header class="head">
  <div class="brand">
    <svg class="logo" viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="6" fill="#4f8cff" />
      <g fill="#0e1116">
        <rect x="8" y="8" width="7" height="7" />
        <rect x="18" y="8" width="6" height="7" />
        <rect x="8" y="18" width="7" height="6" />
        <rect x="18" y="18" width="6" height="6" />
      </g>
    </svg>
    <div>
      <div class="title">PixelForge <span>Studio</span></div>
      <div class="subtitle">Пакетная оптимизация изображений · без сервера</div>
    </div>
  </div>
  <div class="head-right">
    <span class="badge info"><i class="dot"></i>Все данные остаются на устройстве</span>
    <span class="th-pill mono">Потоков: {threads}</span>
    {#if installEvent && !appInstalled}
      <button class="btn btn-pri" on:click={installApp}>Установить приложение</button>
    {/if}
    <button class="btn" on:click={() => showSettings.set(true)}>Настройки</button>
    <button class="btn btn-pri" on:click={() => fileInputEl.click()}>
      <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
        <path d="M8 2a1 1 0 0 1 1 1v4h4a1 1 0 1 1 0 2H9v4a1 1 0 1 1-2 0V9H3a1 1 0 1 1 0-2h4V3a1 1 0 0 1 1-1z" />
      </svg>
      Добавить файлы
    </button>
  </div>
</header>

<input
  bind:this={fileInputEl}
  type="file"
  multiple
  accept="image/*"
  hidden
  on:change={onChangePick}
/>

<main class="body">
  <aside class="side">
    <OptionsPanel />
  </aside>
  <section class="work">
    <DropZone compact={$tasks.length > 0} onPick={() => fileInputEl.click()} />
    {#if $tasks.length > 0}
      <TaskTable />
    {/if}
  </section>
</main>

{#if $tasks.length > 0}
  <footer class="bar">
    <div class="bar-cell">
      <span>Всего: <b class="mono">{$stats.total}</b></span>
      <span>Готово: <b class="mono ok">{$stats.done} / {$stats.total}</b></span>
      {#if $stats.processing}
        <span>В работе: <b class="mono">{$stats.processing}</b></span>
      {/if}
      {#if $stats.queued}
        <span>В очереди: <b class="mono">{$stats.queued}</b></span>
      {/if}
      {#if $stats.errors}
        <span>Ошибки: <b class="mono err">{$stats.errors}</b></span>
      {/if}
      {#if $stats.artifacts}
        <span class="warn">Артефакты: {$stats.artifacts}</span>
      {/if}
    </div>
    <div class="bar-cell grow">
      <span class="mono">Было: {fmtBytes($stats.before)}</span>
      <span class="arrow">→</span>
      <span class="mono ok">Стало: {fmtBytes($stats.after)}</span>
      <div class="savbar">
        <div class="savfill" style="width: {Math.min(100, $stats.savings)}%"></div>
      </div>
      <b class="mono ok big">ЭКОНОМИЯ: {fmtSaving($stats.savings)}</b>
    </div>
    <div class="bar-cell">
      <button class="btn btn-sm" disabled={$stats.total === 0} on:click={clearAll}>Очистить все</button>
      <button class="btn btn-sm btn-ok" disabled={$stats.done === 0 || $busyZip} on:click={downloadZipAll}>
        {#if $busyZip}
          <span class="spin"></span>
        {/if}
        Скачать ZIP {$stats.done ? `(${fmtBytes($stats.after)})` : ''}
      </button>
      <button class="btn btn-sm" disabled={$stats.done === 0} on:click={saveToFolderAll}>Сохранить в папку</button>
      <button class="btn btn-sm" disabled={$stats.done === 0 || $busyPdf} on:click={downloadPdfAll}>
        {#if $busyPdf}
          <span class="spin"></span>
        {/if}
        PDF-каталог
      </button>
      <button class="btn btn-sm" disabled={$stats.done === 0} on:click={exportCsvReport}>CSV-отчёт</button>
    </div>
  </footer>
{/if}

{#if $comparator}
  <CompareModal />
{/if}
{#if $showSettings}
  <SettingsModal />
{/if}

<div class="toasts">
  {#each $toasts as t (t.id)}
    <div class="toast {t.kind}">{t.text}</div>
  {/each}
</div>

<style>
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 14px 20px;
    border-bottom: 1px solid var(--border);
    background: rgba(20, 25, 38, 0.82);
    backdrop-filter: blur(8px);
    position: sticky;
    top: 0;
    z-index: 20;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .logo {
    width: 34px;
    height: 34px;
  }
  .title {
    font-size: 17px;
    font-weight: 800;
    letter-spacing: 0.01em;
  }
  .title span {
    color: var(--accent-strong);
  }
  .subtitle {
    font-size: 12px;
    color: var(--muted);
  }
  .head-right {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .th-pill {
    font-size: 12px;
    color: var(--muted);
    border: 1px solid var(--border);
    padding: 5px 10px;
    border-radius: 999px;
  }
  .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--ok);
    display: inline-block;
  }
  .body {
    display: grid;
    grid-template-columns: 320px 1fr;
    gap: 16px;
    padding: 16px;
    align-items: start;
    flex: 1;
  }
  .side {
    position: sticky;
    top: 76px;
    max-height: calc(100vh - 92px);
    overflow-y: auto;
  }
  .bar {
    position: sticky;
    bottom: 0;
    background: var(--panel);
    border-top: 1px solid var(--border);
    padding: 10px 16px;
    display: flex;
    align-items: center;
    gap: 22px;
    z-index: 20;
  }
  .bar-cell {
    display: flex;
    align-items: center;
    gap: 14px;
    flex-wrap: wrap;
    color: var(--muted);
    font-size: 13px;
  }
  .grow {
    flex: 1;
    justify-content: center;
  }
  .arrow {
    color: var(--accent);
    font-weight: 800;
  }
  .big {
    font-size: 15px;
  }
  .savbar {
    width: 160px;
    height: 8px;
    border-radius: 4px;
    background: var(--panel-3);
    overflow: hidden;
  }
  .savfill {
    height: 100%;
    background: linear-gradient(90deg, #229a61, var(--ok));
    border-radius: 4px;
    transition: width 0.3s;
  }
  .ok {
    color: var(--ok);
  }
  .err {
    color: var(--err);
  }
  .warn {
    color: var(--warn);
  }
  .toasts {
    position: fixed;
    right: 16px;
    bottom: 64px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    z-index: 100;
  }
  .toast {
    background: var(--panel-3);
    border: 1px solid var(--border);
    border-left: 3px solid var(--accent);
    padding: 10px 14px;
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    max-width: 360px;
    animation: fadein 0.2s;
  }
  .toast.ok {
    border-left-color: var(--ok);
  }
  .toast.err {
    border-left-color: var(--err);
  }
  @keyframes fadein {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }
  @media (max-width: 1080px) {
    .body {
      grid-template-columns: 1fr;
    }
    .side {
      position: static;
      max-height: none;
    }
  }
</style>