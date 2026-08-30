import type { FormatMeta, FormattedOutput } from './json.js';
import type { ColumnFormat } from '../templates/queries/registry.js';
import { fmtPercent } from '../utils/stat-format.js';

export function formatMarkdown(
  data: Record<string, unknown>[],
  meta: FormatMeta,
  options: { columnFormats?: Record<string, ColumnFormat> } = {},
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
    (row) =>
      '| ' + columns.map((col) => formatMdCell(row[col], options.columnFormats?.[col])).join(' | ') + ' |',
  );

  // Footer
  const footer = `\n*${meta.sampleSize} rows · Source: ${meta.source} · Season ${meta.season}*`;

  return {
    raw: data,
    formatted: [header, separator, ...rows, footer].join('\n') + '\n',
    meta,
  };
}

function formatMdCell(value: unknown, format?: ColumnFormat): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'number') {
    // Percent rendering only happens on a template-declared hint — a
    // magnitude guess corrupts indices, counts, and rate stats (P1.6).
    if (format === 'percent') return fmtPercent(value);
    if (typeof format === 'object') return value.toFixed(format.decimals);
    if (Number.isInteger(value)) return String(value);
    // Sub-1 rate stats read as .386-style decimals, not "0.4"
    return Math.abs(value) < 1 ? value.toFixed(3) : value.toFixed(1);
  }
  return String(value);
}
