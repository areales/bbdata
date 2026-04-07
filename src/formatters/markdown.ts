import type { FormatMeta, FormattedOutput } from './json.js';

export function formatMarkdown(
  data: Record<string, unknown>[],
  meta: FormatMeta,
): FormattedOutput {
  if (data.length === 0) {
    return { raw: data, formatted: '*No data found.*\n', meta };
  }

  const columns = Object.keys(data[0]);

  // Header row
  const header = '| ' + columns.join(' | ') + ' |';
  const separator = '| ' + columns.map(() => '---').join(' | ') + ' |';

  // Data rows
  const rows = data.map(
    (row) => '| ' + columns.map((col) => formatMdCell(row[col])).join(' | ') + ' |',
  );

  // Footer
  const footer = `\n*${meta.sampleSize} rows · Source: ${meta.source} · Season ${meta.season}*`;

  return {
    raw: data,
    formatted: [header, separator, ...rows, footer].join('\n') + '\n',
    meta,
  };
}

function formatMdCell(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'number') {
    if (Math.abs(value) <= 1 && value !== 0) return (value * 100).toFixed(1) + '%';
    if (Number.isInteger(value)) return String(value);
    return value.toFixed(1);
  }
  return String(value);
}
