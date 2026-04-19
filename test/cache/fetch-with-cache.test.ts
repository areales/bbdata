import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  DataAdapter,
  AdapterQuery,
  AdapterResult,
  DataSource,
  PitchData,
} from '../../src/adapters/types.js';

vi.mock('../../src/cache/store.js', () => ({
  getCached: vi.fn(),
  setCache: vi.fn(),
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

import { fetchWithCache, type CachePolicy } from '../../src/cache/fetch-with-cache.js';
import { getCached, setCache } from '../../src/cache/store.js';

function makeAdapter(source: DataSource, data: PitchData[] = []): DataAdapter {
  const result: AdapterResult<PitchData[]> = {
    data,
    source,
    cached: false,
    fetchedAt: '2026-04-19T00:00:00Z',
    meta: {
      rowCount: data.length,
      season: 2025,
      query: { season: 2025, stat_type: 'pitching' } as AdapterQuery,
    },
  };
  return {
    source,
    description: `${source} mock`,
    supports: () => true,
    resolvePlayer: vi.fn(async () => null),
    fetch: vi.fn(async () => result),
  };
}

const SAMPLE_QUERY: AdapterQuery = {
  player_name: 'Test Player',
  season: 2025,
  stat_type: 'pitching',
};

const ENABLED: CachePolicy = { enabled: true, maxAgeDays: 30 };
const DISABLED: CachePolicy = { enabled: false, maxAgeDays: 30 };

describe('fetchWithCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('cache enabled — cold miss', () => {
    it('calls adapter.fetch when cache is empty', async () => {
      vi.mocked(getCached).mockResolvedValue(null);
      const adapter = makeAdapter('savant');

      await fetchWithCache(adapter, SAMPLE_QUERY, ENABLED);

      expect(getCached).toHaveBeenCalledWith('savant', SAMPLE_QUERY);
      expect(adapter.fetch).toHaveBeenCalledTimes(1);
    });

    it('writes the fetched result to the cache with configured maxAgeDays', async () => {
      vi.mocked(getCached).mockResolvedValue(null);
      const adapter = makeAdapter('savant');

      await fetchWithCache(adapter, SAMPLE_QUERY, { enabled: true, maxAgeDays: 7 });

      expect(setCache).toHaveBeenCalledTimes(1);
      expect(setCache).toHaveBeenCalledWith('savant', SAMPLE_QUERY, expect.any(String), 7);
    });

    it('returns the fresh result with cached: false', async () => {
      vi.mocked(getCached).mockResolvedValue(null);
      const adapter = makeAdapter('savant');

      const result = await fetchWithCache(adapter, SAMPLE_QUERY, ENABLED);

      expect(result.cached).toBe(false);
      expect(result.source).toBe('savant');
    });

    it('passes bypassCache:true to the adapter so the adapter does not double-cache', async () => {
      vi.mocked(getCached).mockResolvedValue(null);
      const adapter = makeAdapter('savant');

      await fetchWithCache(adapter, SAMPLE_QUERY, ENABLED);

      expect(adapter.fetch).toHaveBeenCalledWith(SAMPLE_QUERY, { bypassCache: true });
    });
  });

  describe('cache enabled — warm hit', () => {
    it('returns cached data without calling adapter.fetch', async () => {
      const cachedResult: AdapterResult<PitchData[]> = {
        data: [],
        source: 'savant',
        cached: false,
        fetchedAt: '2026-04-18T00:00:00Z',
        meta: {
          rowCount: 0,
          season: 2025,
          query: { season: 2025, stat_type: 'pitching' } as AdapterQuery,
        },
      };
      vi.mocked(getCached).mockResolvedValue(JSON.stringify(cachedResult));
      const adapter = makeAdapter('savant');

      const result = await fetchWithCache(adapter, SAMPLE_QUERY, ENABLED);

      expect(adapter.fetch).not.toHaveBeenCalled();
      expect(setCache).not.toHaveBeenCalled();
      expect(result.cached).toBe(true);
      expect(result.source).toBe('savant');
    });

    it('preserves the original fetchedAt from the cached payload', async () => {
      const cachedResult: AdapterResult<PitchData[]> = {
        data: [],
        source: 'fangraphs',
        cached: false,
        fetchedAt: '2026-01-15T12:34:56Z',
        meta: {
          rowCount: 0,
          season: 2024,
          query: { season: 2024, stat_type: 'batting' } as AdapterQuery,
        },
      };
      vi.mocked(getCached).mockResolvedValue(JSON.stringify(cachedResult));
      const adapter = makeAdapter('fangraphs');

      const result = await fetchWithCache(adapter, SAMPLE_QUERY, ENABLED);

      expect(result.fetchedAt).toBe('2026-01-15T12:34:56Z');
    });

    it('falls through to adapter.fetch when the cached payload is corrupt JSON', async () => {
      vi.mocked(getCached).mockResolvedValue('{ not valid json');
      const adapter = makeAdapter('savant');

      const result = await fetchWithCache(adapter, SAMPLE_QUERY, ENABLED);

      expect(adapter.fetch).toHaveBeenCalledTimes(1);
      expect(setCache).toHaveBeenCalledTimes(1);
      expect(result.cached).toBe(false);
    });
  });

  describe('cache disabled (bypass or config)', () => {
    it('skips both getCached and setCache', async () => {
      const adapter = makeAdapter('savant');

      await fetchWithCache(adapter, SAMPLE_QUERY, DISABLED);

      expect(getCached).not.toHaveBeenCalled();
      expect(setCache).not.toHaveBeenCalled();
    });

    it('still forwards bypassCache:true so the adapter does not try to cache either', async () => {
      const adapter = makeAdapter('savant');

      await fetchWithCache(adapter, SAMPLE_QUERY, DISABLED);

      expect(adapter.fetch).toHaveBeenCalledWith(SAMPLE_QUERY, { bypassCache: true });
    });

    it('returns the result with cached: false', async () => {
      const adapter = makeAdapter('savant');

      const result = await fetchWithCache(adapter, SAMPLE_QUERY, DISABLED);

      expect(result.cached).toBe(false);
    });
  });

  describe('stdin adapter', () => {
    it('skips cache entirely — stdin is a local in-memory data path', async () => {
      const adapter = makeAdapter('stdin');

      await fetchWithCache(adapter, SAMPLE_QUERY, ENABLED);

      expect(getCached).not.toHaveBeenCalled();
      expect(setCache).not.toHaveBeenCalled();
      expect(adapter.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('error propagation', () => {
    it('lets adapter.fetch errors surface and does not write to cache', async () => {
      vi.mocked(getCached).mockResolvedValue(null);
      const adapter = makeAdapter('savant');
      vi.mocked(adapter.fetch).mockRejectedValueOnce(new Error('upstream down'));

      await expect(fetchWithCache(adapter, SAMPLE_QUERY, ENABLED)).rejects.toThrow('upstream down');
      expect(setCache).not.toHaveBeenCalled();
    });

    it('survives a failed cache write and still returns the fresh result', async () => {
      vi.mocked(getCached).mockResolvedValue(null);
      vi.mocked(setCache).mockRejectedValueOnce(new Error('disk full'));
      const adapter = makeAdapter('savant');

      const result = await fetchWithCache(adapter, SAMPLE_QUERY, ENABLED);

      expect(result.cached).toBe(false);
      expect(result.source).toBe('savant');
    });
  });
});
