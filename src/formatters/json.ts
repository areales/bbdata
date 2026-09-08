import { CLI_VERSION } from '../utils/version.js';

export type OutputFormat = 'json' | 'table' | 'csv' | 'markdown';

export interface FormatMeta {
  source: string;
  cached: boolean;
  queryTimeMs: number;
  season: number;
  sampleSize: number;
  template?: string;
  /**
   * Build that produced this output. Callers don't set it — `formatJson`
   * stamps it — so a downstream consumer can prove which bbdata ran. The
   * published package and a local `dist/` routinely differ.
   */
  cliVersion?: string;
}

export interface FormattedOutput {
  raw: unknown;
  formatted: string;
  meta: FormatMeta;
}

export function formatJson(data: unknown, meta: FormatMeta): FormattedOutput {
  const stamped: FormatMeta = { ...meta, cliVersion: meta.cliVersion ?? CLI_VERSION };
  const output = { data, meta: stamped };
  return {
    raw: data,
    formatted: JSON.stringify(output, null, 2) + '\n',
    meta: stamped,
  };
}
