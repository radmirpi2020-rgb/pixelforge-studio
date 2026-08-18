<script lang="ts">
  import { addFiles } from '../lib/queue';

  export let onPick: () => void;
  export let compact = false;

  let dragging = false;

  function handleFiles(files: FileList | null) {
    if (files && files.length) void addFiles(Array.from(files));
  }

  function onDir(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    handleFiles(input.files);
    input.value = '';
  }

  function dirAttr(node: HTMLInputElement) {
    node.setAttribute('webkitdirectory', '');
    return {};
  }
</script>

<div
  class="drop"
  class:compact
  class:hot={dragging}
  role="group"
  aria-label="Область загрузки изображений"
  on:dragenter|preventDefault={() => (dragging = true)}
  on:dragover|preventDefault={() => (dragging = true)}
  on:dragleave={() => (dragging = false)}
  on:drop|preventDefault={(e) => {
    dragging = false;
    handleFiles(e.dataTransfer?.files ?? null);
  }}
>
  <div class="icon">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
      <path d="M12 16V4m0 0L7 9m5-5l5 5" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" stroke-linecap="round" />
    </svg>
  </div>
  {#if !compact}
    <div class="txt">
      <h3>Перетащите изображения сюда</h3>
      <p>JPG · PNG · WebP · AVIF · BMP · TIFF · SVG — файлы не покидают ваше устройство</p>
    </div>
  {/if}
  <div class="row">
    <button class="btn btn-pri" on:click={onPick}>
      <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
        <path d="M8 2a1 1 0 0 1 1 1v4h4a1 1 0 1 1 0 2H9v4a1 1 0 1 1-2 0V9H3a1 1 0 1 1 0-2h4V3a1 1 0 0 1 1-1z" />
      </svg>
      Добавить файлы
    </button>
    <label class="btn">
      <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
        <path d="M2 5.5A1.5 1.5 0 0 1 3.5 4h2l1-1.5h3L10.5 4h2A1.5 1.5 0 0 1 14 5.5v6a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5z" stroke-linejoin="round" />
        <circle cx="8" cy="8.5" r="2.2" />
      </svg>
      Выбрать папку
      <input type="file" multiple hidden use:dirAttr on:change={onDir} />
    </label>
  </div>
  {#if compact}
    <span class="hint">или перетащите ещё файлы сюда</span>
  {/if}
</div>

<style>
  .drop {
    border: 1.5px dashed var(--border);
    border-radius: var(--radius);
    background: var(--panel);
    padding: 44px 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: 14px;
    text-align: center;
    transition: border-color 0.15s, background 0.15s;
  }
  .drop.hot {
    border-color: var(--accent);
    background: rgba(79, 140, 255, 0.08);
  }
  .drop.compact {
    padding: 12px 16px;
    flex-direction: column;
    gap: 10px;
  }
  .drop.compact .row {
    margin: 0;
  }
  .icon {
    width: 52px;
    height: 52px;
    border-radius: 14px;
    background: rgba(79, 140, 255, 0.14);
    color: var(--accent-strong);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .icon svg {
    width: 28px;
    height: 28px;
  }
  h3 {
    margin: 0 0 4px;
    font-size: 16px;
  }
  p {
    margin: 0;
    color: var(--muted);
    font-size: 13px;
  }
  .row {
    display: flex;
    gap: 10px;
    margin-top: 4px;
  }
  .hint {
    color: var(--muted);
    font-size: 12px;
  }
</style>