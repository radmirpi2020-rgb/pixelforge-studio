<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { tasks, comparator } from '../lib/store';
  import { reprocessTask } from '../lib/queue';
  import { fmtBytes } from '../lib/format';

  let beforeUrl: string | null = null;
  let afterUrl: string | null = null;
  let lastTaskId: string | null = null;
  let lastAfterBlob: Blob | null = null;
  let divider = 50;
  let zoom = 1;
  let ox = 50;
  let oy = 50;
  let dragging = false;
  let q = 85;
  let shp = 0;
  let busy = false;
  let viewEl: HTMLDivElement;

  $: task = $tasks.find((t) => t.id === $comparator) ?? null;

  $: {
    const current = task;
    if (current?.id !== lastTaskId) {
      if (beforeUrl) URL.revokeObjectURL(beforeUrl);
      beforeUrl = current ? URL.createObjectURL(current.file) : null;
      q = current?.customOverrides?.quality ?? 85;
      shp = Math.round((current?.customOverrides?.sharpen ?? 0) * 100);
      divider = 50;
      zoom = 1;
      lastTaskId = current?.id ?? null;
      lastAfterBlob = current?.resultBlob ?? null;
      if (afterUrl) URL.revokeObjectURL(afterUrl);
      afterUrl = current?.resultBlob ? URL.createObjectURL(current.resultBlob) : null;
    } else if (current?.resultBlob !== lastAfterBlob) {
      if (afterUrl) URL.revokeObjectURL(afterUrl);
      afterUrl = current?.resultBlob ? URL.createObjectURL(current.resultBlob) : null;
      lastAfterBlob = current?.resultBlob ?? null;
    }
  }

  $: outW = task?.metrics?.outWidth ?? 0;
  $: outH = task?.metrics?.outHeight ?? 0;
  $: ratioPct = outW && outH ? (outH / outW) * 100 : 100;
  $: done = task?.status === 'COMPLETED' && !!task.resultBlob;

  onMount(() => {
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  });

  onDestroy(() => {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
    if (beforeUrl) URL.revokeObjectURL(beforeUrl);
    if (afterUrl) URL.revokeObjectURL(afterUrl);
  });

  function startDrag(e: MouseEvent) {
    e.preventDefault();
    dragging = true;
  }

  function onMove(e: MouseEvent) {
    if (!dragging || !viewEl) return;
    const rect = viewEl.getBoundingClientRect();
    divider = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
  }

  function onUp() {
    dragging = false;
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    if (!viewEl) return;
    const rect = viewEl.getBoundingClientRect();
    ox = ((e.clientX - rect.left) / rect.width) * 100;
    oy = ((e.clientY - rect.top) / rect.height) * 100;
    zoom = Math.min(4, Math.max(1, zoom * (e.deltaY < 0 ? 1.12 : 0.89)));
  }

  function zoomBy(f: number) {
    zoom = Math.min(4, Math.max(1, zoom * f));
  }

  async function apply() {
    if (!task) return;
    busy = true;
    await reprocessTask(task.id, { quality: q, sharpen: shp / 100 });
    busy = false;
  }

  function close() {
    comparator.set(null);
  }

  function ssimGrade(v?: number): { label: string; cls: string } {
    if (v == null) return { label: '—', cls: '' };
    if (v >= 0.98) return { label: 'ОТЛИЧНО', cls: 'ok' };
    if (v >= 0.92) return { label: 'ХОРОШО', cls: 'warn' };
    return { label: 'АРТЕФАКТЫ', cls: 'err' };
  }

  function psnrText(v?: number): string {
    if (v == null) return '—';
    if (v >= 40) return 'артефакты неразличимы';
    if (v >= 30) return 'заметны при увеличении';
    return 'видны';
  }
</script>

{#if task}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="modal-backdrop" on:click|self={close}>
    <div class="modal card">
      <header>
        <div class="hdr">
          <div class="fname" title={task.file.name}>{task.file.name}</div>
          <div class="fmeta mono">
            {task.originalWidth}×{task.originalHeight} px · {fmtBytes(task.file.size)}
          </div>
        </div>
        <button class="btn btn-sm" on:click={close}>Закрыть</button>
      </header>

      {#if task.status === 'QUEUED' || task.status === 'PROCESSING'}
        <div class="busy">
          <span class="spin"></span>
          Пересчёт изображения…
        </div>
      {:else if done}
        <div class="stage" bind:this={viewEl} on:wheel={onWheel}>
          <div class="view" style="padding-bottom:{ratioPct}%">
            <img
              class="img after"
              src={afterUrl ?? ''}
              alt="После"
              style="transform:scale({zoom});transform-origin:{ox}% {oy}%;"
            />
            <div class="clip" style="clip-path:inset(0 {100 - divider}% 0 0);">
              <img
                class="img before"
                src={beforeUrl ?? ''}
                alt="До"
                style="transform:scale({zoom});transform-origin:{ox}% {oy}%;"
              />
            </div>
            <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
            <div class="divider" role="separator" aria-orientation="vertical" style="left:{divider}%;" on:mousedown={startDrag}>
              <span class="handle"></span>
            </div>
            <span class="tag tag-a">ДО · {fmtBytes(task.file.size)}</span>
            <span class="tag tag-b">ПОСЛЕ · {fmtBytes(task.resultBlob?.size ?? 0)}</span>
          </div>
          <div class="zoombar">
            <span class="mono zm">Зум: {zoom.toFixed(1)}× · колесо мыши</span>
            <button class="btn btn-icon" on:click={() => zoomBy(0.8)}>−</button>
            <button class="btn btn-icon" on:click={() => zoomBy(1.25)}>+</button>
            <button class="btn btn-icon" on:click={() => (zoom = 1)}>Сброс</button>
          </div>
        </div>

        {#if task.metrics}
          <div class="metrics">
            <div class="m">
              <span class="k">SSIM</span>
              <span class="mono v">{task.metrics.ssimScore?.toFixed(3) ?? '—'}</span>
              <span class="badge {ssimGrade(task.metrics.ssimScore).cls}">
                {ssimGrade(task.metrics.ssimScore).label}
              </span>
            </div>
            <div class="m">
              <span class="k">PSNR</span>
              <span class="mono v">{task.metrics.psnrDb?.toFixed(1) ?? '—'} dB</span>
              <span class="muted">{psnrText(task.metrics.psnrDb)}</span>
            </div>
            <div class="m">
              <span class="k">Размер</span>
              <span class="mono v">{fmtBytes(task.file.size)} → {fmtBytes(task.metrics.processedSize)}</span>
              <span class="mono ok">-{task.metrics.compressionRatio.toFixed(1)}%</span>
            </div>
            <div class="m">
              <span class="k">Время</span>
              <span class="mono v">{task.metrics.processingTimeMs.toFixed(0)} мс</span>
            </div>
          </div>
        {/if}

        <div class="corr">
          <label class="field grow">
            <span>Качество: {q}%</span>
            <input type="range" min="1" max="100" bind:value={q} />
          </label>
          <label class="field grow">
            <span>Резкость (Unsharp): {shp}%</span>
            <input type="range" min="0" max="100" bind:value={shp} />
          </label>
          <button class="btn btn-pri" disabled={busy} on:click={apply}>
            {#if busy}<span class="spin"></span>{/if}
            Применить и пересчитать
          </button>
        </div>
      {:else if task.status === 'ERROR'}
        <div class="busy err">
          Ошибка: {task.errorMessage ?? 'неизвестна'}
        </div>
      {:else}
        <div class="busy">Задача не найдена</div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .modal {
    width: min(1100px, 96vw);
    max-height: 92vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
  }
  .fname {
    font-weight: 700;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 60vw;
  }
  .fmeta {
    color: var(--muted);
    font-size: 12px;
  }
  .busy {
    padding: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    color: var(--muted);
  }
  .busy.err {
    color: var(--err);
  }
  .stage {
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .view {
    position: relative;
    height: 0;
    width: 100%;
    background: #0a0d13;
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
    cursor: ew-resize;
    user-select: none;
    max-height: 62vh;
  }
  .img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: fill;
    transition: transform 0.05s linear;
    pointer-events: none;
  }
  .clip {
    position: absolute;
    inset: 0;
  }
  .divider {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 2px;
    background: rgba(255, 255, 255, 0.75);
    margin-left: -1px;
    cursor: ew-resize;
    z-index: 3;
    box-shadow: 0 0 8px rgba(0, 0, 0, 0.5);
  }
  .handle {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 26px;
    height: 40px;
    border-radius: 6px;
    background: #fff;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #223;
    font-weight: 800;
    font-size: 13px;
  }
  .handle::before {
    content: '<';
    margin-right: 4px;
  }
  .handle::after {
    content: '>';
    margin-left: 4px;
  }
  .tag {
    position: absolute;
    top: 10px;
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 700;
    z-index: 4;
    pointer-events: none;
    backdrop-filter: blur(4px);
  }
  .tag-a {
    left: 10px;
    background: rgba(79, 140, 255, 0.85);
    color: #fff;
  }
  .tag-b {
    right: 10px;
    background: rgba(57, 217, 138, 0.85);
    color: #06231a;
  }
  .zoombar {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 6px;
  }
  .zm {
    color: var(--muted);
    font-size: 12px;
    margin-right: auto;
  }
  .metrics {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
    padding: 0 14px;
  }
  .m {
    background: var(--panel-2);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .k {
    color: var(--muted);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .v {
    font-size: 15px;
    font-weight: 700;
  }
  .muted {
    color: var(--muted);
    font-size: 12px;
  }
  .ok {
    color: var(--ok);
  }
  .corr {
    display: flex;
    align-items: flex-end;
    gap: 14px;
    padding: 14px;
    border-top: 1px solid var(--border);
    margin-top: 14px;
  }
  .grow {
    flex: 1;
  }
  @media (max-width: 900px) {
    .metrics {
      grid-template-columns: 1fr 1fr;
    }
  }
</style>