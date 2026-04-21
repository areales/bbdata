import type { OutputFormat, FormatMeta, FormattedOutput } from './json.js';
import { formatJson } from './json.js';
import { formatTable } from './table.js';
import { formatCsv } from './csv.js';
import { formatMarkdown } from './markdown.js';

export type { OutputFormat, FormatMeta, FormattedOutput };

export function format(
  data: Record<string, unknown>[],
  meta: FormatMeta,
  outputFormat: OutputFormat,
  options?: { columns?: string[] },
): FormattedOutput {
  switch (outputFormat) {
    case 'json':
      return formatJson(data, meta);
    case 'table':
      return formatTable(data, meta, options);
    case 'csv':
      return formatCsv(data, meta);
    case 'markdown':
      return formatMarkdown(data, meta);
    default:
      throw new Error(`Unsupported output format "${String(outputFormat)}". Supported: json, table, csv, markdown.`);
  }
}
