export type OutputFormat = 'json' | 'table' | 'csv' | 'markdown';

export interface FormatMeta {
  source: string;
  cached: boolean;
  queryTimeMs: number;
  season: number;
  sampleSize: number;
  template?: string;
}

export interface FormattedOutput {
  raw: unknown;
  formatted: string;
  meta: FormatMeta;
}

export function formatJson(data: unknown, meta: FormatMeta): FormattedOutput {
  const output = { data, meta };
  return {
    raw: data,
    formatted: JSON.stringify(output, null, 2) + '\n',
    meta,
  };
}
