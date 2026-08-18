export function fmtBytes(n: number | undefined | null): string {
  if (!n || n <= 0) return '—';
  const units = ['Б', 'КБ', 'МБ', 'ГБ'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v >= 100 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

export function fmtSaving(ratio: number): string {
  if (!isFinite(ratio) || ratio <= 0) return '0%';
  return `${ratio.toFixed(1)}%`;
}

export function fmtNumber(n: number): string {
  return n.toLocaleString('ru-RU');
}