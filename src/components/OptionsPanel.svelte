<script lang="ts">
  import { options, presetId, customPresets, pushToast } from '../lib/store';
  import { MARKETPLACE_PRESETS, makeWatermark, describePresetOptions } from '../lib/presets';
  import { deleteCustomPreset, putCustomPreset } from '../lib/idb';
  import { uid } from '../lib/uuid';
  import type {
    FitMode,
    MarketplacePreset,
    ProcessingOptions,
    SupportedOutputFormat,
    WatermarkConfig,
    WatermarkPosition,
    WatermarkType
  } from '../lib/types';

  let saveMode = false;
  let presetName = '';
  let logoEl: HTMLInputElement;

  $: p = $options;
  $: padKnown = ['#FFFFFF', '#000000', 'BLUR_PAD'].includes(p.backgroundPaddingColor);

  function edit(fn: (o: ProcessingOptions) => void): void {
    options.update((o) => {
      const next = { ...o };
      fn(next);
      presetId.set(null);
      return next;
    });
  }

  function editWatermark(fn: (w: WatermarkConfig) => void): void {
    options.update((o) => {
      const next = { ...o, watermark: { ...(o.watermark ?? makeWatermark()) } };
      fn(next.watermark);
      presetId.set(null);
      return next;
    });
  }

  function selectPreset(pr: MarketplacePreset | null): void {
    presetId.set(pr ? pr.id : 'custom');
    if (pr) options.set(structuredClone(pr.options));
  }

  async function savePreset(): Promise<void> {
    const name = presetName.trim();
    if (!name) return;
    const pr: MarketplacePreset = {
      id: uid(),
      name,
      icon: 'user',
      description: describePresetOptions($options),
      options: structuredClone($options)
    };
    await putCustomPreset(pr);
    customPresets.update((l) => [...l, pr]);
    presetName = '';
    saveMode = false;
    pushToast(`Пресет «${name}» сохранён (IndexedDB)`, 'ok');
  }

  async function removeCustom(pr: MarketplacePreset): Promise<void> {
    await deleteCustomPreset(pr.id);
    customPresets.update((l) => l.filter((x) => x.id !== pr.id));
    if ($presetId === pr.id) presetId.set(null);
  }

  function onLogoPick() {
    const f = logoEl.files?.[0];
    if (f) {
      editWatermark((w) => {
        w.type = 'IMAGE';
        w.imageBlob = f;
      });
    }
  }

  function numW(e: Event): void {
    const v = (e.currentTarget as HTMLInputElement).value;
    const n = parseFloat(v);
    edit((o) => {
      o.targetWidth = v === '' || isNaN(n) ? undefined : n;
    });
  }

  function numH(e: Event): void {
    const v = (e.currentTarget as HTMLInputElement).value;
    const n = parseFloat(v);
    edit((o) => {
      o.targetHeight = v === '' || isNaN(n) ? undefined : n;
    });
  }

  function formatChange(e: Event): void {
    edit((o) => {
      o.outputFormat = (e.currentTarget as HTMLSelectElement).value as SupportedOutputFormat;
    });
  }

  function qualityChange(e: Event): void {
    edit((o) => {
      o.quality = +(e.currentTarget as HTMLInputElement).value;
    });
  }

  function fitChange(e: Event): void {
    edit((o) => {
      o.fitMode = (e.currentTarget as HTMLSelectElement).value as FitMode;
    });
  }

  function aspectChange(e: Event): void {
    edit((o) => {
      o.maintainAspectRatio = (e.currentTarget as HTMLInputElement).checked;
    });
  }

  function padChange(e: Event): void {
    const v = (e.currentTarget as HTMLSelectElement).value;
    edit((o) => {
      o.backgroundPaddingColor = v === '__custom__' ? '#888888' : v;
    });
  }

  function padColorChange(e: Event): void {
    edit((o) => {
      o.backgroundPaddingColor = (e.currentTarget as HTMLInputElement).value;
    });
  }

  function stripChange(e: Event): void {
    edit((o) => {
      o.stripMetadata = (e.currentTarget as HTMLInputElement).checked;
    });
  }

  function sharpenChange(e: Event): void {
    edit((o) => {
      o.sharpen = +(e.currentTarget as HTMLInputElement).value / 100;
    });
  }

  function wmToggle(e: Event): void {
    edit((o) => {
      o.watermark = (e.currentTarget as HTMLInputElement).checked ? makeWatermark() : undefined;
    });
  }

  function wmTypeChange(e: Event): void {
    editWatermark((w) => {
      w.type = (e.currentTarget as HTMLSelectElement).value as WatermarkType;
    });
  }

  function wmTextChange(e: Event): void {
    editWatermark((w) => {
      w.text = (e.currentTarget as HTMLInputElement).value;
    });
  }

  function wmFontChange(e: Event): void {
    editWatermark((w) => {
      w.fontFamily = (e.currentTarget as HTMLSelectElement).value;
    });
  }

  function wmColorChange(e: Event): void {
    editWatermark((w) => {
      w.colorHex = (e.currentTarget as HTMLInputElement).value;
    });
  }

  function wmSizeChange(e: Event): void {
    editWatermark((w) => {
      w.fontSizePercent = +(e.currentTarget as HTMLInputElement).value;
    });
  }

  function wmOpacityChange(e: Event): void {
    editWatermark((w) => {
      w.opacity = +(e.currentTarget as HTMLInputElement).value / 100;
    });
  }

  function wmPosChange(e: Event): void {
    editWatermark((w) => {
      w.position = (e.currentTarget as HTMLSelectElement).value as WatermarkPosition;
    });
  }

  function wmPadChange(e: Event): void {
    editWatermark((w) => {
      w.paddingPx = +(e.currentTarget as HTMLInputElement).value || 0;
    });
  }

  function wmRotChange(e: Event): void {
    editWatermark((w) => {
      w.rotationDegrees = +(e.currentTarget as HTMLInputElement).value;
    });
  }

  function tmplChange(e: Event): void {
    edit((o) => {
      o.outputNameTemplate = (e.currentTarget as HTMLInputElement).value;
    });
  }
</script>

<div class="card wrap">
  <div class="sec-title">Пресеты маркетплейсов</div>
  <div class="chips">
    {#each MARKETPLACE_PRESETS as pr (pr.id)}
      <button class="chip" class:on={$presetId === pr.id} title={pr.description} on:click={() => selectPreset(pr)}>
        <i class="pi pi-{pr.icon}"></i>
        {pr.name}
      </button>
    {/each}
    {#each $customPresets as pr (pr.id)}
      <button class="chip" class:on={$presetId === pr.id} title={pr.description} on:click={() => selectPreset(pr)}>
        <i class="pi pi-user"></i>
        {pr.name}
        <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
        <span class="del" on:click|stopPropagation={() => removeCustom(pr)} title="Удалить пресет">✕</span>
      </button>
    {/each}
    <button class="chip" class:on={$presetId === 'custom'} on:click={() => selectPreset(null)}>
      <i class="pi pi-gear"></i>
      Свой
    </button>
  </div>
  {#if $presetId && $presetId !== 'custom'}
    {#each [...MARKETPLACE_PRESETS, ...$customPresets] as pr (pr.id)}
      {#if pr.id === $presetId}
        <div class="preset-desc">{pr.description}</div>
      {/if}
    {/each}
  {/if}

  <div class="grid2">
    <label class="field">
      <span>Формат вывода</span>
      <select value={p.outputFormat} on:change={formatChange}>
        <option value="webp">WebP</option>
        <option value="jpeg">JPEG</option>
        <option value="png">PNG (без потерь)</option>
        <option value="avif">AVIF</option>
      </select>
    </label>
    <label class="field">
      <span>Качество{p.outputFormat === 'png' ? ' — без потерь' : `: ${p.quality}%`}</span>
      <input type="range" min="1" max="100" value={p.quality} disabled={p.outputFormat === 'png'} on:input={qualityChange} />
    </label>
  </div>

  <label class="field">
    <span>Ресайз</span>
    <select value={p.fitMode} on:change={fitChange}>
      <option value="NONE">Нет (исходный размер)</option>
      <option value="CONTAIN">Вписать — с полями (Smart Pad)</option>
      <option value="COVER">Заполнить — с обрезкой</option>
      <option value="EXACT">Точно — растянуть</option>
      <option value="SCALE_WIDTH">По ширине</option>
      <option value="SCALE_HEIGHT">По высоте</option>
    </select>
  </label>

  {#if p.fitMode !== 'NONE'}
    <div class="grid2">
      <label class="field">
        <span>Ширина, px</span>
        <input type="number" min="1" placeholder="авто" value={p.targetWidth ?? ''} on:input={numW} />
      </label>
      <label class="field">
        <span>Высота, px</span>
        <input type="number" min="1" placeholder="авто" value={p.targetHeight ?? ''} on:input={numH} />
      </label>
    </div>
    {#if p.fitMode === 'CONTAIN' || p.fitMode === 'EXACT'}
      <label class="check">
        <input type="checkbox" checked={p.maintainAspectRatio} on:change={aspectChange} />
        Сохранять пропорции
      </label>
    {/if}
  {/if}

  {#if p.fitMode === 'CONTAIN' && p.maintainAspectRatio}
    <label class="field">
      <span>Заполнение полей</span>
      <select value={padKnown ? p.backgroundPaddingColor : '__custom__'} on:change={padChange}>
        <option value="#FFFFFF">Белый</option>
        <option value="#000000">Чёрный</option>
        <option value="BLUR_PAD">Размытый фон (Blur Pad)</option>
        <option value="__custom__">Пользовательский цвет…</option>
      </select>
    </label>
    {#if !padKnown}
      <input
        type="color"
        value={p.backgroundPaddingColor.startsWith('#') ? p.backgroundPaddingColor : '#888888'}
        on:input={padColorChange}
      />
    {/if}
  {/if}

  <label class="check">
    <input type="checkbox" checked={p.stripMetadata} on:change={stripChange} />
    Стереть EXIF / GPS / XMP (бинарный уровень)
  </label>

  <label class="field">
    <span>Резкость пакета: {Math.round(p.sharpen * 100)}%</span>
    <input type="range" min="0" max="100" value={Math.round(p.sharpen * 100)} on:input={sharpenChange} />
  </label>

  <div class="sec-title">Водяной знак</div>
  <label class="check">
    <input type="checkbox" checked={!!p.watermark} on:change={wmToggle} />
    Наложить водяной знак
  </label>

  {#if p.watermark}
    <div class="wm">
      <label class="field">
        <span>Тип</span>
        <select value={p.watermark.type} on:change={wmTypeChange}>
          <option value="TEXT">Текст</option>
          <option value="IMAGE">Логотип</option>
        </select>
      </label>

      {#if p.watermark.type === 'TEXT'}
        <label class="field">
          <span>Текст</span>
          <input type="text" value={p.watermark.text ?? ''} on:input={wmTextChange} />
        </label>
        <div class="grid2">
          <label class="field">
            <span>Шрифт</span>
            <select value={p.watermark.fontFamily} on:change={wmFontChange}>
              <option value="Arial">Arial</option>
              <option value="Arial Black">Arial Black</option>
              <option value="Georgia">Georgia</option>
              <option value="Verdana">Verdana</option>
              <option value="Times New Roman">Times New Roman</option>
              <option value="Courier New">Courier New</option>
            </select>
          </label>
          <label class="field">
            <span>Цвет</span>
            <input type="color" value={p.watermark.colorHex} on:input={wmColorChange} />
          </label>
        </div>
      {:else}
        <label class="field">
          <span>Логотип (PNG с прозрачностью)</span>
          <button class="btn btn-sm" on:click={() => logoEl.click()}>
            {p.watermark.imageBlob ? p.watermark.imageBlob.name : 'Выбрать файл…'}
          </button>
          <input bind:this={logoEl} type="file" accept="image/png,image/svg+xml,image/webp" hidden on:change={onLogoPick} />
        </label>
      {/if}

      <label class="field">
        <span>Размер: {p.watermark.fontSizePercent}% от высоты</span>
        <input type="range" min="2" max="25" value={p.watermark.fontSizePercent} on:input={wmSizeChange} />
      </label>
      <label class="field">
        <span>Прозрачность: {Math.round(p.watermark.opacity * 100)}%</span>
        <input type="range" min="5" max="100" value={Math.round(p.watermark.opacity * 100)} on:input={wmOpacityChange} />
      </label>
      <label class="field">
        <span>Позиция</span>
        <select value={p.watermark.position} on:change={wmPosChange}>
          <option value="CENTER">Центр</option>
          <option value="TOP_LEFT">Верх слева</option>
          <option value="TOP_RIGHT">Верх справа</option>
          <option value="BOTTOM_LEFT">Низ слева</option>
          <option value="BOTTOM_RIGHT">Низ справа</option>
          <option value="TILED_DIAGONAL">Диагональная сетка</option>
        </select>
      </label>
      <div class="grid2">
        <label class="field">
          <span>Отступ, px</span>
          <input type="number" min="0" max="200" value={p.watermark.paddingPx} on:input={wmPadChange} />
        </label>
        {#if p.watermark.position === 'TILED_DIAGONAL'}
          <label class="field">
            <span>Наклон: {p.watermark.rotationDegrees}°</span>
            <input type="range" min="-45" max="45" value={p.watermark.rotationDegrees} on:input={wmRotChange} />
          </label>
        {/if}
      </div>
    </div>
  {/if}

  <label class="field">
    <span>Шаблон имени файла</span>
    <input type="text" value={p.outputNameTemplate} on:input={tmplChange} />
    <small>{'{name}'} · {'{w}'} · {'{h}'} · {'{ext}'}</small>
  </label>

  {#if saveMode}
    <div class="saveform">
      <input type="text" placeholder="Название пресета" bind:value={presetName} />
      <div class="row2">
        <button class="btn btn-sm btn-pri" on:click={savePreset}>Сохранить</button>
        <button class="btn btn-sm" on:click={() => (saveMode = false)}>Отмена</button>
      </div>
    </div>
  {:else}
    <button class="btn btn-sm" on:click={() => (saveMode = true)}>Сохранить текущие как пресет</button>
  {/if}
</div>

<style>
  .wrap {
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .sec-title {
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.09em;
    color: var(--muted);
    border-bottom: 1px solid var(--border);
    padding-bottom: 6px;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .pi {
    width: 8px;
    height: 8px;
    border-radius: 2px;
    display: inline-block;
  }
  .pi-wb { background: #8c5cff; }
  .pi-oz { background: #005bff; }
  .pi-av { background: #0af; }
  .pi-ym { background: #ffcc00; }
  .pi-web { background: #39d98a; }
  .pi-user { background: #ff7ab8; }
  .pi-gear { background: #8b97ad; }
  .del {
    margin-left: 2px;
    opacity: 0.6;
    font-size: 11px;
  }
  .del:hover {
    opacity: 1;
    color: var(--err);
  }
  .preset-desc {
    font-size: 12px;
    color: var(--muted);
  }
  .grid2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .wm {
    display: flex;
    flex-direction: column;
    gap: 10px;
    background: var(--panel-2);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px;
  }
  small {
    color: var(--muted);
    font-size: 11px;
  }
  .saveform {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .saveform input {
    background: var(--panel-2);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 8px 10px;
    color: var(--text);
    outline: none;
  }
  .row2 {
    display: flex;
    gap: 8px;
  }
</style>