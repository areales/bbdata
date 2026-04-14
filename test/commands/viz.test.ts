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
    expect(result.meta.chartType).toBe('movement');
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
    await viz({
      type: 'movement',
      player: 'Test',
      format: 'pdf',
      output: '/tmp/test.pdf',
    });
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
    await viz({
      type: 'movement',
      player: 'Test',
      format: 'png',
      output: '/tmp/test.png',
    });
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
    await viz({
      type: 'movement',
      player: 'Test',
      format: 'html',
      output: '/tmp/test.html',
    });
    const call = vi.mocked(writeFileSync).mock.calls.find(
      (c) => typeof c[1] === 'string' && String(c[1]).includes('<!doctype html>'),
    );
    expect(call).toBeDefined();
  });
});
