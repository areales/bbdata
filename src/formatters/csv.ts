import { stringify } from 'csv-stringify/sync';
import type { FormatMeta, FormattedOutput } from './json.js';

export function formatCsv(
  data: Record<string, unknown>[],
  meta: FormatMeta,
): FormattedOutput {
  if (data.length === 0) {
    return { raw: data, formatted: '', meta };
  }

  const columns = Object.keys(data[0]);
  const formatted = stringify(data, { header: true, columns });

  return { raw: data, formatted, meta };
}
