<script lang="ts">
  import { tasks, comparator } from '../lib/store';
  import { removeTask, retryTask } from '../lib/queue';
  import { fmtBytes } from '../lib/format';
</script>

<div class="card table-wrap">
  <table>
    <thead>
      <tr>
        <th class="n">#</th>
        <th>Файл</th>
        <th>До</th>
        <th>После</th>
        <th>Разрешение</th>
        <th>Статус</th>
        <th class="n"></th>
      </tr>
    </thead>
    <tbody>
      {#each $tasks as t, i (t.id)}
        <tr class:risk={t.artifactRisk}>
          <td class="mono idx">{String(i + 1).padStart(2, '0')}</td>
          <td class="file">
            {#if t.previewUrl}
              <img src={t.previewUrl} alt="" />
            {:else}
              <span class="th ph"></span>
            {/if}
            <div class="meta">
              <span class="nm" title={t.file.name}>{t.file.name}</span>
              {#if t.relativePath}
                <span class="rp" title={t.relativePath}>{t.relativePath}</span>
              {/if}
            </div>
          </td>
          <td class="mono">{fmtBytes(t.file.size)}</td>
          <td class="mono">
            {#if t.status === 'COMPLETED' && t.metrics}
              <span class="ok">{fmtBytes(t.metrics.processedSize)}</span>
              <span class="saving">-{t.metrics.compressionRatio.toFixed(1)}%</span>
            {:else if t.status === 'PROCESSING'}
              <span class="muted">{t.progress}%</span>
            {:else if t.status === 'ERROR'}
              <span class="muted">—</span>
            {:else}
              <span class="muted">ожидание</span>
            {/if}
          </td>
          <td class="mono dims">
            {t.originalWidth}×{t.originalHeight}
            {#if t.metrics?.outWidth && t.metrics.outWidth !== t.originalWidth}
              <span class="muted">→ {t.metrics.outWidth}×{t.metrics.outHeight}</span>
            {/if}
          </td>
          <td>
            {#if t.status === 'QUEUED'}
              <span class="badge info">В очереди</span>
            {:else if t.status === 'PROCESSING'}
              <div class="prog">
                <span class="badge info">В работе</span>
                <div class="pbar">
                  <div style="width:{t.progress}%"></div>
                </div>
              </div>
            {:else if t.status === 'COMPLETED'}
              <span class="badge ok">ГОТОВО</span>
            {:else}
              <span class="badge err" title={t.errorMessage}>ОШИБКА</span>
            {/if}
            {#if t.artifactRisk}
              <span class="badge warn" title="SSIM < 0.92 — возможны видимые артефакты сжатия">SSIM</span>
            {/if}
            {#if t.metrics?.fallbackFormat}
              <span class="badge info">AVIF→WebP</span>
            {/if}
          </td>
          <td class="acts">
            {#if t.status === 'COMPLETED'}
              <button class="btn btn-icon" title="Сравнить До/После" on:click={() => comparator.set(t.id)}>
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" stroke-linejoin="round" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </button>
            {/if}
            {#if t.status === 'ERROR'}
              <button class="btn btn-icon" title="Повторить" on:click={() => retryTask(t.id)}>
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                  <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                  <path d="M21 3v6h-6" />
                </svg>
              </button>
            {/if}
            <button class="btn btn-danger btn-icon" title="Убрать из очереди" on:click={() => removeTask(t.id)}>
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .table-wrap {
    overflow-x: auto;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  th {
    text-align: left;
    padding: 10px 12px;
    color: var(--muted);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    border-bottom: 1px solid var(--border);
    white-space: nowrap;
  }
  td {
    padding: 8px 12px;
    border-bottom: 1px solid rgba(39, 49, 74, 0.55);
    vertical-align: middle;
    white-space: nowrap;
  }
  tr:last-child td {
    border-bottom: none;
  }
  tr:hover td {
    background: rgba(33, 42, 61, 0.35);
  }
  tr.risk td {
    background: rgba(255, 176, 32, 0.05);
  }
  tr.risk:hover td {
    background: rgba(255, 176, 32, 0.1);
  }
  .n {
    width: 40px;
  }
  .idx {
    color: var(--muted);
  }
  .file {
    display: flex;
    align-items: center;
    gap: 10px;
    max-width: 260px;
  }
  .file img {
    width: 42px;
    height: 42px;
    object-fit: cover;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: #10141d;
  }
  .th {
    width: 42px;
    height: 42px;
    border-radius: 6px;
    background: #10141d;
    display: inline-block;
  }
  .meta {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .nm {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 600;
  }
  .rp {
    color: var(--muted);
    font-size: 11px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .muted {
    color: var(--muted);
  }
  .ok {
    color: var(--ok);
  }
  .saving {
    color: var(--ok);
    font-size: 11px;
    margin-left: 6px;
  }
  .dims .muted {
    font-size: 11px;
  }
  .prog {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .pbar {
    width: 60px;
    height: 6px;
    border-radius: 3px;
    background: var(--panel-3);
    overflow: hidden;
  }
  .pbar div {
    height: 100%;
    background: var(--accent);
    border-radius: 3px;
    transition: width 0.25s;
  }
  .acts {
    display: flex;
    gap: 4px;
    justify-content: flex-end;
  }
</style>