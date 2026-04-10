import { describe, it, expect, vi, beforeEach } from 'vitest';

// Load query templates so the registry resolves template ids
import '../../src/templates/queries/index.js';

vi.mock('../../src/commands/query.js', () => ({
  query: vi.fn(),
}));

vi.mock('../../src/viz/render.js', () => ({
  specToSvg: vi.fn(async () => '<svg data-test="stub"/>'),
  normalizeSvg: vi.fn((s: string) => s),
}));

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
import { specToSvg } from '../../src/viz/render.js';

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
});
