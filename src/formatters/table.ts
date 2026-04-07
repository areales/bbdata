import Table from 'cli-table3';
import chalk from 'chalk';
import type { FormatMeta, FormattedOutput } from './json.js';

export function formatTable(
  data: Record<string, unknown>[],
  meta: FormatMeta,
  options: { columns?: string[] } = {},
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
    table.push(columns.map((col) => formatCell(row[col])));
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

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return chalk.gray('—');
  if (typeof value === 'number') {
    // Format percentages
    if (Math.abs(value) <= 1 && value !== 0) {
      return (value * 100).toFixed(1) + '%';
    }
    // Format large numbers
    if (Number.isInteger(value) && value > 999) {
      return value.toLocaleString();
    }
    return value.toFixed(1);
  }
  return String(value);
}
