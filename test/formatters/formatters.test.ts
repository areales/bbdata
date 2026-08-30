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

  it('threads columnFormats through to markdown', () => {
    const data = [{ Metric: 'K%', Value: 0.192 }];
    const md = format(data, sampleMeta, 'markdown', {
      columnFormats: { Value: 'percent' },
    });
    expect(md.formatted).toContain('19.2%');
  });
});

describe('numeric cell rendering (P1.6 regression)', () => {
  // The old magnitude heuristic rewrote any number in (-1, 1) as a
  // percentage: leaderboard Rank 1 → "100.0%", zone-grid index 1 →
  // "100.0%", xwOBA 0.386 → "38.6%", an In Play count of 1 → "100.0%".
  // Percent rendering now requires a template-declared column hint.

  const gridData = [
    { zone: 'High-In', row: 0, col: 1, pitches: 1, xwoba: 0.386 },
    { zone: 'Mid-Out', row: 1, col: 2, pitches: 214, xwoba: 0.291 },
  ];

  it('markdown: counts and indices stay integers; xwOBA keeps 3 decimals', () => {
    const md = formatMarkdown(gridData, sampleMeta);
    const lines = md.formatted.split('\n');
    expect(lines[2]).toBe('| High-In | 0 | 1 | 1 | 0.386 |');
    expect(lines[3]).toBe('| Mid-Out | 1 | 2 | 214 | 0.291 |');
  });

  it('table: counts and indices stay integers; xwOBA keeps 3 decimals', () => {
    const table = formatTable(gridData, sampleMeta);
    expect(table.formatted).not.toContain('%');
    expect(table.formatted).toContain('0.386');
    expect(table.formatted).toContain('214');
  });

  it('table: small integers render without a decimal tail', () => {
    const table = formatTable([{ PA: 0, Rank: 1 }], sampleMeta);
    expect(table.formatted).not.toContain('0.0');
    expect(table.formatted).not.toContain('1.0');
    expect(table.formatted).not.toContain('%');
  });

  it('table: large integers keep thousands separators', () => {
    const table = formatTable([{ Pitches: 2849 }], sampleMeta);
    expect(table.formatted).toContain((2849).toLocaleString());
  });

  it('renders a ratio as a percentage only under a declared percent hint', () => {
    const data = [{ Player: 'Judge', 'K%': 0.192 }];
    const withHint = formatMarkdown(data, sampleMeta, { columnFormats: { 'K%': 'percent' } });
    expect(withHint.formatted).toContain('19.2%');

    const withoutHint = formatMarkdown(data, sampleMeta);
    expect(withoutHint.formatted.split('\n')[2]).toBe('| Judge | 0.192 |');
  });

  it('applies fixed-decimal hints consistently across a column straddling 1.0', () => {
    const data = [{ plate_x: 0.95 }, { plate_x: 1.05 }];
    const md = formatMarkdown(data, sampleMeta, {
      columnFormats: { plate_x: { decimals: 2 } },
    });
    expect(md.formatted).toContain('| 0.95 |');
    expect(md.formatted).toContain('| 1.05 |');
  });

  it('still renders null and undefined as em-dash', () => {
    const md = formatMarkdown([{ a: null, b: 0.5 }], sampleMeta);
    expect(md.formatted).toContain('—');
    expect(md.formatted).toContain('0.500');
  });
});
