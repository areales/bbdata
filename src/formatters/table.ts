import Table from 'cli-table3';
import chalk from 'chalk';
import type { FormatMeta, FormattedOutput } from './json.js';
import type { ColumnFormat } from '../templates/queries/registry.js';
import { fmtPercent } from '../utils/stat-format.js';

export function formatTable(
  data: Record<string, unknown>[],
  meta: FormatMeta,
  options: { columns?: string[]; columnFormats?: Record<string, ColumnFormat> } = {},
): FormattedOutput {
  if (data.length === 0) {
    return {
      raw: data,
      formatted: 'No data found.\n',
      meta,
    };
  }

  // Use specified columns or infer from first row
  const columns = options.columns ?? Object.keys(data[0]);

  const table = new Table({
    head: columns.map((col) => chalk.bold(col)),
    style: { head: ['cyan'] },
  });

  for (const row of data) {
    table.push(columns.map((col) => formatCell(row[col], options.columnFormats?.[col])));
  }

  const footer = chalk.gray(
    `\n${meta.sampleSize} rows · Source: ${meta.source} · ${meta.cached ? 'cached' : 'live'}`,
  );

  return {
    raw: data,
    formatted: table.toString() + footer + '\n',
    meta,
  };
}

function formatCell(value: unknown, format?: ColumnFormat): string {
  if (value === null || value === undefined) return chalk.gray('—');
  if (typeof value === 'number') {
    // Percent rendering only happens on a template-declared hint — a
    // magnitude guess corrupts indices, counts, and rate stats (P1.6).
    if (format === 'percent') return fmtPercent(value);
    if (typeof format === 'object') return value.toFixed(format.decimals);
    if (Number.isInteger(value)) {
      return value > 999 ? value.toLocaleString() : String(value);
    }
    // Sub-1 rate stats read as .386-style decimals, not "0.4"
    return Math.abs(value) < 1 ? value.toFixed(3) : value.toFixed(1);
  }
  return String(value);
}
