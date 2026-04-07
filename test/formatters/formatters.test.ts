import { describe, it, expect } from 'vitest';
import { formatJson, type FormatMeta } from '../../src/formatters/json.js';
import { formatCsv } from '../../src/formatters/csv.js';
import { formatMarkdown } from '../../src/formatters/markdown.js';
import { formatTable } from '../../src/formatters/table.js';
import { format } from '../../src/formatters/index.js';

const sampleMeta: FormatMeta = {
  source: 'savant',
  cached: false,
  queryTimeMs: 1200,
  season: 2025,
  sampleSize: 2,
  template: 'pitcher-arsenal',
};

const sampleData = [
  { 'Pitch Type': 'Four-Seam Fastball', 'Usage %': '55.0%', 'Avg Velo': '95.5 mph', Pitches: 100 },
  { 'Pitch Type': 'Slider', 'Usage %': '30.0%', 'Avg Velo': '87.2 mph', Pitches: 55 },
];

describe('formatJson', () => {
  it('wraps data in a { data, meta } envelope', () => {
    const result = formatJson(sampleData, sampleMeta);
    const parsed = JSON.parse(result.formatted);

    expect(parsed).toHaveProperty('data');
    expect(parsed).toHaveProperty('meta');
    expect(parsed.data).toEqual(sampleData);
    expect(parsed.meta.source).toBe('savant');
  });

  it('returns raw data in the raw field', () => {
    const result = formatJson(sampleData, sampleMeta);
    expect(result.raw).toBe(sampleData);
  });

  it('ends with a newline', () => {
    const result = formatJson(sampleData, sampleMeta);
    expect(result.formatted.endsWith('\n')).toBe(true);
  });
});

describe('formatCsv', () => {
  it('produces CSV with header row', () => {
    const result = formatCsv(sampleData, sampleMeta);
    const lines = result.formatted.split('\n').filter(Boolean);

    expect(lines[0]).toContain('Pitch Type');
    expect(lines[0]).toContain('Usage %');
    expect(lines.length).toBe(3); // header + 2 data rows
  });

  it('returns empty string for empty data', () => {
    const result = formatCsv([], sampleMeta);
    expect(result.formatted).toBe('');
  });
});

describe('formatMarkdown', () => {
  it('produces a markdown table with header and separator', () => {
    const result = formatMarkdown(sampleData, sampleMeta);
    const lines = result.formatted.split('\n');

    // Header row
    expect(lines[0]).toMatch(/^\| Pitch Type .* \|$/);
    // Separator row
    expect(lines[1]).toMatch(/^\| --- .* \|$/);
    // Data rows
    expect(lines[2]).toContain('Four-Seam Fastball');
    expect(lines[3]).toContain('Slider');
  });

  it('includes footer with metadata', () => {
    const result = formatMarkdown(sampleData, sampleMeta);
    expect(result.formatted).toContain('Source: savant');
    expect(result.formatted).toContain('Season 2025');
  });

  it('returns "No data found" for empty data', () => {
    const result = formatMarkdown([], sampleMeta);
    expect(result.formatted).toContain('No data found');
  });
});

describe('formatTable', () => {
  it('produces non-empty output with data rows', () => {
    const result = formatTable(sampleData, sampleMeta);
    expect(result.formatted.length).toBeGreaterThan(0);
    expect(result.formatted).toContain('Four-Seam Fastball');
    expect(result.formatted).toContain('Slider');
  });

  it('returns "No data found" for empty data', () => {
    const result = formatTable([], sampleMeta);
    expect(result.formatted).toContain('No data found');
  });
});

describe('format (dispatcher)', () => {
  it('routes to the correct formatter by type', () => {
    const json = format(sampleData, sampleMeta, 'json');
    expect(JSON.parse(json.formatted)).toHaveProperty('data');

    const csv = format(sampleData, sampleMeta, 'csv');
    expect(csv.formatted).toContain('Pitch Type');

    const md = format(sampleData, sampleMeta, 'markdown');
    expect(md.formatted).toContain('|');
  });
});
