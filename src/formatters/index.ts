import type { OutputFormat, FormatMeta, FormattedOutput } from './json.js';
import type { ColumnFormat } from '../templates/queries/registry.js';
import { formatJson } from './json.js';
import { formatTable } from './table.js';
import { formatCsv } from './csv.js';
import { formatMarkdown } from './markdown.js';
import { CLI_VERSION } from '../utils/version.js';

export type { OutputFormat, FormatMeta, FormattedOutput };

export function format(
  data: Record<string, unknown>[],
  meta: FormatMeta,
  outputFormat: OutputFormat,
  options?: { columns?: string[]; columnFormats?: Record<string, ColumnFormat> },
): FormattedOutput {
  // P5.5: stamp the build here so all four formatters return the same meta.
  // Only JSON serializes meta into its output — the other three render data
  // alone — but a programmatic caller reading `result.meta` gets the version
  // regardless of which format it asked for.
  const stamped: FormatMeta = { ...meta, cliVersion: meta.cliVersion ?? CLI_VERSION };
  switch (outputFormat) {
    case 'json':
      return formatJson(data, stamped);
    case 'table':
      return formatTable(data, stamped, options);
    case 'csv':
      return formatCsv(data, stamped);
    case 'markdown':
      return formatMarkdown(data, stamped, { columnFormats: options?.columnFormats });
    default:
      throw new Error(`Unsupported output format "${String(outputFormat)}". Supported: json, table, csv, markdown.`);
  }
}
