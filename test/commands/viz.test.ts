import { describe, it, expect, vi, beforeEach } from 'vitest';

// Load query templates so the registry resolves template ids
import '../../src/templates/queries/index.js';

vi.mock('../../src/commands/query.js', () => ({
  query: vi.fn(),
}));

vi.mock('../../src/viz/render.js', () => ({
  specToSvg: vi.fn(async () => '<svg data-test="stub"/>'),
  specToHtml: vi.fn(
    (svg: string, _spec: object, opts?: { title?: string }) =>
      `<!doctype html><html><title>${opts?.title ?? 'x'}</title>${svg}</html>`,
  ),
  specToPdf: vi.fn(async () => Buffer.from('%PDF-1.7\n%%EOF\n')),
  normalizeSvg: vi.fn((s: string) => s),
}));

vi.mock('../../src/viz/rasterize.js', () => ({
  rasterizeSvg: vi.fn(() => Buffer.from([0x89, 0x50, 0x4e, 0x47])),
}));

vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  return {
    ...actual,
    writeFileSync: vi.fn(),
  };
});

vi.mock('../../src/utils/logger.js', () => ({
  log: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    data: vi.fn(),
  },
}));

vi.mock('../../src/config/config.js', () => ({
  getConfig: vi.fn(() => ({
    defaultFormat: 'json',
    defaultAudience: 'analyst',
    cache: { enabled: true, maxAgeDays: 30, directory: '' },
    templates: { directory: '' },
    sources: {},
  })),
  getConfigDir: vi.fn(() => '/tmp/bbdata'),
  getCacheDir: vi.fn(() => '/tmp/bbdata/cache'),
  getTemplatesDir: vi.fn(() => '/tmp/bbdata/templates'),
  setConfig: vi.fn(),
}));

import { viz } from '../../src/commands/viz.js';
import { query as runQuery } from '../../src/commands/query.js';
import { specToSvg, specToPdf } from '../../src/viz/render.js';
import { rasterizeSvg } from '../../src/viz/rasterize.js';
import { writeFileSync } from 'node:fs';

describe('viz command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(runQuery).mockResolvedValue({
      data: [
        { pitch_type: 'FF', pfx_x: 0.8, pfx_z: 1.2, release_speed: 95 },
        { pitch_type: 'SL', pfx_x: -0.5, pfx_z: 0.4, release_speed: 87 },
      ],
      formatted: '{}',
      meta: {
        template: 'pitcher-raw-pitches',
        source: 'savant',
        cached: false,
        rowCount: 2,
        season: 2025,
      },
    });
  });

  it('fetches raw pitches and returns a VizResult', async () => {
    const result = await viz({
      type: 'movement',
      player: 'Corbin Burnes',
      season: 2025,
      audience: 'analyst',
    });

    expect(runQuery).toHaveBeenCalledTimes(1);
    expect(vi.mocked(runQuery).mock.calls[0]![0].template).toBe('pitcher-raw-pitches');
    expect(result.svg).toBe('<svg data-test="stub"/>');
    expect(result.formatted).toBe('<svg data-test="stub"/>');
    expect(result.meta.chartType).toBe('movement');
    expect(result.meta.format).toBe('svg');
    expect(result.meta.player).toBe('Corbin Burnes');
    expect(result.meta.audience).toBe('analyst');
    expect(result.meta.rowCount).toBe(2);
    expect(specToSvg).toHaveBeenCalledTimes(1);
  });

  it('maps the gm audience to frontoffice', async () => {
    const result = await viz({
      type: 'movement',
      player: 'Test',
      audience: 'gm',
    });
    expect(result.meta.audience).toBe('frontoffice');
  });

  it('throws for an unknown chart type', async () => {
    await expect(
      // @ts-expect-error — deliberately invalid
      viz({ type: 'nonexistent', player: 'Test' }),
    ).rejects.toThrow('Unknown chart type');
  });

  it('passes colorblind flag through to the spec builder', async () => {
    const result = await viz({
      type: 'zone',
      player: 'Test',
      colorblind: true,
    });
    // The stub specToSvg returns the same SVG regardless, but we can assert
    // the spec object was produced
    expect(result.spec).toBeDefined();
  });

  it('uses audience-specific default dimensions', async () => {
    const coach = await viz({ type: 'movement', player: 'Test', audience: 'coach' });
    const analyst = await viz({ type: 'movement', player: 'Test', audience: 'analyst' });
    expect(coach.meta.width).toBeGreaterThan(analyst.meta.width);
  });

  it('resolves a domain-prefixed alias to its canonical chart type', async () => {
    const result = await viz({
      type: 'pitching-movement',
      player: 'Test',
      audience: 'analyst',
    });
    expect(result.meta.chartType).toBe('movement');
  });

  it('writes a PDF binary when format=pdf with --output (vector default)', async () => {
    const result = await viz({
      type: 'movement',
      player: 'Test',
      format: 'pdf',
      output: '/tmp/test.pdf',
    });
    expect(Buffer.isBuffer(result.formatted)).toBe(true);
    expect(specToPdf).toHaveBeenCalledTimes(1);
    const call = vi.mocked(specToPdf).mock.calls[0]!;
    expect(call[1].mode).toBe('vector');
    const writeCall = vi.mocked(writeFileSync).mock.calls.find((c) => Buffer.isBuffer(c[1]));
    expect(writeCall).toBeDefined();
  });

  it('threads --pdf-mode raster through to specToPdf', async () => {
    await viz({
      type: 'movement',
      player: 'Test',
      format: 'pdf',
      pdfMode: 'raster',
      dpi: 300,
      output: '/tmp/test.pdf',
    });
    const call = vi.mocked(specToPdf).mock.calls[0]!;
    expect(call[1].mode).toBe('raster');
    expect(call[1].dpi).toBe(300);
  });

  it('throws a clear error for unknown formats', async () => {
    await expect(
      // @ts-expect-error — deliberately invalid
      viz({ type: 'movement', player: 'Test', format: 'gif' }),
    ).rejects.toThrow(/Unsupported --format "gif"/);
  });

  it('threads --window into the query options for the rolling chart', async () => {
    vi.mocked(runQuery).mockResolvedValueOnce({
      data: [{ 'Window End': '2025-04-01', AVG: '0.300' }],
      formatted: '{}',
      meta: {
        template: 'trend-rolling-average',
        source: 'savant',
        cached: false,
        rowCount: 1,
        season: 2025,
      },
    });
    await viz({
      type: 'rolling',
      player: 'Freddie Freeman',
      season: 2025,
      window: 5,
    });
    const call = vi.mocked(runQuery).mock.calls[0]![0];
    expect(call.window).toBe(5);
    expect(call.template).toBe('trend-rolling-average');
  });

  it('rasterizes to PNG and writes a binary file when format=png with --output', async () => {
    const result = await viz({
      type: 'movement',
      player: 'Test',
      format: 'png',
      output: '/tmp/test.png',
    });
    expect(Buffer.isBuffer(result.formatted)).toBe(true);
    expect(rasterizeSvg).toHaveBeenCalledTimes(1);
    expect(writeFileSync).toHaveBeenCalled();
    const firstCall = vi.mocked(writeFileSync).mock.calls[0]!;
    expect(Buffer.isBuffer(firstCall[1])).toBe(true);
  });

  it('scales raster width by --dpi when provided (dpi=300 → 3.125× baseline 96)', async () => {
    await viz({
      type: 'movement',
      player: 'Test',
      audience: 'analyst',
      format: 'png',
      output: '/tmp/t.png',
      width: 800,
      dpi: 300,
    });
    const call = vi.mocked(rasterizeSvg).mock.calls[0]!;
    expect(call[1]).toEqual({ width: Math.round(800 * (300 / 96)) });
  });

  it('writes an HTML wrapper when format=html with --output', async () => {
    const result = await viz({
      type: 'movement',
      player: 'Test',
      format: 'html',
      output: '/tmp/test.html',
    });
    expect(typeof result.formatted).toBe('string');
    expect(result.formatted).toContain('<!doctype html>');
    const call = vi.mocked(writeFileSync).mock.calls.find(
      (c) => typeof c[1] === 'string' && String(c[1]).includes('<!doctype html>'),
    );
    expect(call).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// P5.1 — --players actually drives a chart now
// ---------------------------------------------------------------------------

/** hitter-season-profile's real output shape: formatted strings, "—" for gaps. */
function seasonProfileRows(overrides: Record<string, string> = {}) {
  const base: Record<string, string> = {
    AVG: '0.322', OBP: '0.441', SLG: '0.701', wOBA: '0.477', 'wRC+': '218',
    ISO: '0.379', HR: '58', 'BB%': '18.8%', 'K%': '24.3%', WAR: '10.8',
  };
  const merged = { ...base, ...overrides };
  return Object.entries(merged).map(([Metric, Value]) => ({ Metric, Value }));
}

describe('P5.1 — viz --players', () => {
  beforeEach(() => {
    // Sibling describe, so the outer block's clear does not run for these.
    vi.clearAllMocks();
    vi.mocked(runQuery).mockResolvedValue({
      data: seasonProfileRows(),
      formatted: '{}',
      meta: {
        template: 'hitter-season-profile',
        source: 'fangraphs',
        cached: false,
        sampleSize: 10,
        season: 2025,
        queryTimeMs: 0,
        cliVersion: '0.0.0-test',
      },
    });
  });

  it('rejects --players on a chart that cannot compare, naming one that can', async () => {
    await expect(
      viz({ type: 'spray', players: ['Aaron Judge', 'Shohei Ohtani'], season: 2025 }),
    ).rejects.toThrow(/plots one player.*comparison/s);

    await expect(
      viz({ type: 'spray', players: ['Aaron Judge', 'Shohei Ohtani'], season: 2025 }),
    ).rejects.toThrow(/comparison/);
  });

  it('still accepts a single-name --players on a non-comparison chart', async () => {
    // One name is unambiguous — it means the same thing as --player, so
    // rejecting it would break a working command for no honesty gain.
    vi.mocked(runQuery).mockResolvedValue({
      data: [{ pitch_type: 'FF', pfx_x: 0.8, pfx_z: 1.2, release_speed: 95 }],
      formatted: '{}',
      meta: { template: 'pitcher-raw-pitches', source: 'savant', cached: false, sampleSize: 1, season: 2025, queryTimeMs: 0, cliVersion: '0.0.0-test' },
    });
    const result = await viz({ type: 'movement', players: ['Corbin Burnes'], season: 2025 });
    expect(result.meta.chartType).toBe('movement');
  });

  it('fetches once per player and reports the whole roster in meta', async () => {
    const result = await viz({
      type: 'comparison',
      players: ['Aaron Judge', 'Shohei Ohtani', 'Juan Soto'],
      season: 2025,
    });

    expect(runQuery).toHaveBeenCalledTimes(3);
    expect(result.meta.players).toEqual(['Aaron Judge', 'Shohei Ohtani', 'Juan Soto']);
    // `player` stays a single name — defaultTitle and the report embed want one.
    expect(result.meta.player).toBe('Aaron Judge');
    expect(result.meta.rowCount).toBe(30);
  });

  it('rejects a comparison of one rather than rendering an empty chart', async () => {
    // A single-name roster used to reach the builder untagged, so the chart
    // rendered "No comparable season data" at exit 0 for a player who has data.
    await expect(
      viz({ type: 'comparison', player: 'Aaron Judge', season: 2025 }),
    ).rejects.toThrow(/two or more players.*Aaron Judge/s);

    await expect(
      viz({ type: 'comparison', players: ['Aaron Judge'], season: 2025 }),
    ).rejects.toThrow(/two or more players/);
  });

  it('rejects a comparison with no players at all', async () => {
    await expect(viz({ type: 'comparison', season: 2025 })).rejects.toThrow(
      /two or more players/,
    );
  });

  it('folds --player into --players instead of dropping it', async () => {
    const result = await viz({
      type: 'comparison',
      player: 'Aaron Judge',
      players: ['Shohei Ohtani'],
      season: 2025,
    });
    expect(result.meta.players).toEqual(['Aaron Judge', 'Shohei Ohtani']);
  });

  it('collapses a name repeated across --player and --players', async () => {
    const result = await viz({
      type: 'comparison',
      player: 'Aaron Judge',
      players: ['Aaron Judge', 'Juan Soto'],
      season: 2025,
    });
    expect(result.meta.players).toEqual(['Aaron Judge', 'Juan Soto']);
    expect(runQuery).toHaveBeenCalledTimes(2);
  });

  it('resolves the compare alias to the comparison builder', async () => {
    const result = await viz({
      type: 'compare',
      players: ['Aaron Judge', 'Juan Soto'],
      season: 2025,
    });
    expect(result.meta.chartType).toBe('comparison');
  });

  it('fails loudly when a player has no data rather than omitting them', async () => {
    vi.mocked(runQuery).mockImplementation(async (opts: { player?: string }) => {
      if (opts.player === 'Nonexistent Player') {
        throw new Error('Adapter(s) [fangraphs] returned 0 rows');
      }
      return {
        data: seasonProfileRows(),
        formatted: '{}',
        meta: { template: 'hitter-season-profile', source: 'fangraphs', cached: false, sampleSize: 10, season: 2025, queryTimeMs: 0, cliVersion: '0.0.0-test' },
      };
    });

    await expect(
      viz({ type: 'comparison', players: ['Aaron Judge', 'Nonexistent Player'], season: 2025 }),
    ).rejects.toThrow(/silently omit/);
  });

  it('builds one facet per metric with a bar per player', async () => {
    const result = await viz({
      type: 'comparison',
      players: ['Aaron Judge', 'Juan Soto'],
      season: 2025,
    });

    const spec = result.spec as {
      facet: { field: string };
      spec: { mark: { type: string }; encoding: { x: { field: string }; tooltip: { field: string }[] } };
      data: { values: { player: string; metric: string; display: string }[] };
    };
    expect(spec.facet.field).toBe('metric');
    expect(spec.spec.mark.type).toBe('bar');
    expect(spec.spec.encoding.x.field).toBe('player');
    expect(new Set(spec.data.values.map((v) => v.player))).toEqual(
      new Set(['Aaron Judge', 'Juan Soto']),
    );
    // The tooltip shows bbdata's own formatted string, not the parsed number.
    expect(spec.spec.encoding.tooltip.some((t) => t.field === 'display')).toBe(true);
    expect(spec.data.values.find((v) => v.metric === 'BB%')?.display).toBe('18.8%');
  });

  it('drops a missing metric instead of plotting it as zero', async () => {
    vi.mocked(runQuery).mockImplementation(async (opts: { player?: string }) => ({
      data: opts.player === 'Juan Soto' ? seasonProfileRows({ WAR: '—' }) : seasonProfileRows(),
      formatted: '{}',
      meta: { template: 'hitter-season-profile', source: 'fangraphs', cached: false, sampleSize: 10, season: 2025, queryTimeMs: 0, cliVersion: '0.0.0-test' },
    }));

    const result = await viz({
      type: 'comparison',
      players: ['Aaron Judge', 'Juan Soto'],
      season: 2025,
    });

    const values = (result.spec as { data: { values: { player: string; metric: string; value: number }[] } }).data.values;
    const sotoWar = values.find((v) => v.player === 'Juan Soto' && v.metric === 'WAR');
    expect(sotoWar).toBeUndefined();
    // Every other metric still plots for that player.
    expect(values.filter((v) => v.player === 'Juan Soto')).toHaveLength(9);
    // A zero bar would read as "replacement level", which is a claim the data never made.
    expect(values.some((v) => v.player === 'Juan Soto' && v.value === 0)).toBe(false);
  });

  it('titles the chart with every player when none is given', async () => {
    const result = await viz({
      type: 'comparison',
      players: ['Aaron Judge', 'Juan Soto'],
      season: 2025,
    });
    const spec = result.spec as { title: string };
    expect(spec.title).toBe('Aaron Judge vs Juan Soto (2025)');
  });
});
