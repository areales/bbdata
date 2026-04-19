import { describe, it, expect, vi, beforeEach } from 'vitest';

// Import templates to register them before mocking adapters
import '../../src/templates/queries/index.js';

vi.mock('../../src/adapters/index.js', () => ({
  resolveAdapters: vi.fn(),
  getAdapter: vi.fn(),
  getAllAdapters: vi.fn(),
}));

vi.mock('../../src/cache/store.js', () => ({
  getCached: vi.fn(),
  setCache: vi.fn(),
}));

vi.mock('../../src/utils/logger.js', () => ({
  log: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), success: vi.fn(), error: vi.fn(), data: vi.fn() },
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
  // Source-enable filtering (R2.1): these tests exercise adapter fallback logic
  // and intentionally treat all sources as enabled. Real enable-filtering
  // behavior is covered in test/config/sources.test.ts.
  isSourceEnabled: vi.fn(() => true),
  sourceConfigKey: vi.fn((src: string) => src),
}));

import { query } from '../../src/commands/query.js';
import { resolveAdapters } from '../../src/adapters/index.js';
import { getCached, setCache } from '../../src/cache/store.js';

const MOCK_PITCH: Record<string, unknown> = {
  pitch_type: 'FF',
  release_speed: 95.2,
  release_spin_rate: 2400,
  pfx_x: -1.2,
  pfx_z: 1.8,
  plate_x: 0.3,
  plate_z: 2.5,
  description: 'swinging_strike',
  events: null,
  bb_type: null,
  stand: 'R',
  p_throws: 'R',
  pitcher: '123456',
  player_name: 'Test Player',
  batter: '654321',
  batter_name: 'Test Batter',
  game_date: '2025-06-01',
};

function makeMockAdapter(data: unknown[] = [MOCK_PITCH]) {
  return {
    source: 'savant' as const,
    description: 'Mock',
    supports: () => true,
    resolvePlayer: vi.fn(),
    fetch: vi.fn().mockResolvedValue({
      data,
      source: 'savant',
      cached: false,
      fetchedAt: new Date().toISOString(),
      meta: { rowCount: data.length, season: 2025, query: {} },
    }),
  };
}

describe('query command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws for unknown template', async () => {
    await expect(
      query({ template: 'nonexistent-template' }),
    ).rejects.toThrow('Unknown template');
  });

  it('throws when required param is missing', async () => {
    // pitcher-arsenal requires --player
    await expect(
      query({ template: 'pitcher-arsenal' }),
    ).rejects.toThrow('requires --player');
  });

  it('returns data from adapter through template transform', async () => {
    const mockAdapter = makeMockAdapter();
    vi.mocked(resolveAdapters).mockReturnValue([mockAdapter]);

    const result = await query({
      template: 'pitcher-arsenal',
      player: 'Test Player',
      season: 2025,
      format: 'json',
    });

    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('formatted');
    expect(result).toHaveProperty('meta');
    expect(result.meta.template).toBe('pitcher-arsenal');
    expect(result.meta.source).toBe('savant');
    expect(result.meta.sampleSize).toBeGreaterThanOrEqual(0);
    expect(typeof result.meta.queryTimeMs).toBe('number');
  });

  it('tries next adapter when first fails', async () => {
    const failAdapter = {
      source: 'savant' as const,
      description: 'Fail',
      supports: () => true,
      resolvePlayer: vi.fn(),
      fetch: vi.fn().mockRejectedValue(new Error('Savant down')),
    };
    const successAdapter = makeMockAdapter();
    successAdapter.source = 'fangraphs' as any;

    vi.mocked(resolveAdapters).mockReturnValue([failAdapter, successAdapter]);

    await query({
      template: 'pitcher-arsenal',
      player: 'Test Player',
      season: 2025,
    });

    expect(failAdapter.fetch).toHaveBeenCalled();
    expect(successAdapter.fetch).toHaveBeenCalled();
  });

  it('throws when all adapters fail', async () => {
    const failAdapter = {
      source: 'savant' as const,
      description: 'Fail',
      supports: () => true,
      resolvePlayer: vi.fn(),
      fetch: vi.fn().mockRejectedValue(new Error('All down')),
    };

    vi.mocked(resolveAdapters).mockReturnValue([failAdapter]);

    await expect(
      query({ template: 'pitcher-arsenal', player: 'Test', season: 2025 }),
    ).rejects.toThrow('All down');
  });

  it('BBDATA-002: distinct error when no adapter supports the query', async () => {
    const unsupportedAdapter = {
      source: 'savant' as const,
      description: 'Mock',
      supports: () => false,
      resolvePlayer: vi.fn(),
      fetch: vi.fn(),
    };
    vi.mocked(resolveAdapters).mockReturnValue([unsupportedAdapter]);

    await expect(
      query({ template: 'pitcher-arsenal', player: 'Test', season: 2025 }),
    ).rejects.toThrow(/No registered adapter supports query type/);
  });

  it('BBDATA-002: distinct error when adapters return 0 rows', async () => {
    const zeroRowAdapter = makeMockAdapter([]);
    vi.mocked(resolveAdapters).mockReturnValue([zeroRowAdapter]);

    try {
      await query({ template: 'pitcher-arsenal', player: 'Test', season: 2026 });
      expect.fail('expected query() to throw');
    } catch (err) {
      const msg = (err as Error).message;
      expect(msg).toContain('returned 0 rows');
      expect(msg).toContain('savant');
      expect(msg).toContain('season=2026');
    }
  });

  describe('caching (R1.1)', () => {
    // Use `mockResolvedValueOnce` in every test so the queued return doesn't
    // bleed into sibling tests (vi.clearAllMocks clears call history but not
    // mock implementations).

    it('checks the cache and writes the adapter result back on a cold miss', async () => {
      vi.mocked(getCached).mockResolvedValueOnce(null);
      const mockAdapter = makeMockAdapter();
      vi.mocked(resolveAdapters).mockReturnValue([mockAdapter]);

      await query({
        template: 'pitcher-arsenal',
        player: 'Test Player',
        season: 2025,
      });

      expect(getCached).toHaveBeenCalledWith('savant', expect.any(Object));
      expect(mockAdapter.fetch).toHaveBeenCalledTimes(1);
      expect(setCache).toHaveBeenCalledWith('savant', expect.any(Object), expect.any(String), 30);
    });

    it('returns cached data without calling adapter.fetch on a warm hit', async () => {
      const mockAdapter = makeMockAdapter();
      const cachedPayload = JSON.stringify({
        data: [MOCK_PITCH],
        source: 'savant',
        cached: false,
        fetchedAt: '2026-04-18T00:00:00Z',
        meta: { rowCount: 1, season: 2025, query: {} },
      });
      vi.mocked(getCached).mockResolvedValueOnce(cachedPayload);
      vi.mocked(resolveAdapters).mockReturnValue([mockAdapter]);

      const result = await query({
        template: 'pitcher-arsenal',
        player: 'Test Player',
        season: 2025,
      });

      expect(mockAdapter.fetch).not.toHaveBeenCalled();
      expect(setCache).not.toHaveBeenCalled();
      expect(result.meta.cached).toBe(true);
    });

    it('bypasses cache when options.cache === false (--no-cache)', async () => {
      const mockAdapter = makeMockAdapter();
      vi.mocked(resolveAdapters).mockReturnValue([mockAdapter]);

      await query({
        template: 'pitcher-arsenal',
        player: 'Test Player',
        season: 2025,
        cache: false,
      });

      expect(getCached).not.toHaveBeenCalled();
      expect(setCache).not.toHaveBeenCalled();
      expect(mockAdapter.fetch).toHaveBeenCalledTimes(1);
    });
  });

  it('BBDATA-002: thrown-adapter error includes adapter name and query params', async () => {
    const failAdapter = {
      source: 'savant' as const,
      description: 'Fail',
      supports: () => true,
      resolvePlayer: vi.fn(),
      fetch: vi.fn().mockRejectedValue(new Error('connection refused')),
    };
    vi.mocked(resolveAdapters).mockReturnValue([failAdapter]);

    try {
      await query({ template: 'pitcher-arsenal', player: 'Test Player', season: 2025 });
      expect.fail('expected query() to throw');
    } catch (err) {
      const msg = (err as Error).message;
      expect(msg).toContain('threw while fetching');
      expect(msg).toContain('savant');
      expect(msg).toContain('player=Test Player');
      expect(msg).toContain('connection refused');
    }
  });
});
