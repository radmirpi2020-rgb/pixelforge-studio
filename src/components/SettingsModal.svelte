<script lang="ts">
  import { settings, showSettings, pushToast } from '../lib/store';
  import { ensurePool } from '../lib/queue';

  $: t = $settings.threads;
  $: mem = $settings.memoryGateMb;
  $: cores = navigator.hardwareConcurrency || 4;

  function setThreads(v: number) {
    settings.update((s) => ({ ...s, threads: v }));
    ensurePool();
    pushToast(v > 0 ? `Пул воркеров: ${v}` : 'Пул воркеров: авто', 'info');
  }

  function setMem(v: number) {
    settings.update((s) => ({ ...s, memoryGateMb: v }));
  }

  function threadsChange(e: Event) {
    setThreads(+(e.currentTarget as HTMLSelectElement).value);
  }

  function memChange(e: Event) {
    setMem(+(e.currentTarget as HTMLInputElement).value);
  }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<div class="modal-backdrop" on:click|self={() => showSettings.set(false)}>
  <div class="modal card">
    <header>
      <b>Настройки</b>
      <button class="btn btn-sm" on:click={() => showSettings.set(false)}>Закрыть</button>
    </header>
    <div class="body">
      <label class="field">
        <span>Рабочие потоки (Web Workers)</span>
        <select value={t} on:change={threadsChange}>
          <option value="0">Авто (ядер: {cores})</option>
          <option value="1">1</option>
          <option value="2">2</option>
          <option value="3">3</option>
          <option value="4">4</option>
          <option value="5">5</option>
          <option value="6">6</option>
          <option value="7">7</option>
          <option value="8">8</option>
        </select>
      </label>
      <label class="field">
        <span>Лимит памяти воркеров (Memory Watchdog): {mem} МБ</span>
        <input type="range" min="256" max="2048" step="64" value={mem} on:input={memChange} />
      </label>
      <p class="note">
        Все файлы обрабатываются локально: Web Workers, OffscreenCanvas и Wasm-кодеки.
        Данные не покидают ваш браузер.
      </p>
    </div>
  </div>
</div>

<style>
  .modal {
    width: min(480px, 94vw);
    display: flex;
    flex-direction: column;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
    font-size: 15px;
  }
  .body {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .note {
    margin: 0;
    color: var(--muted);
    font-size: 12px;
    line-height: 1.5;
  }
</style>