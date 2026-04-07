import { describe, it, expect, vi, beforeEach } from 'vitest';

// Import templates to register them before mocking adapters
import '../../src/templates/queries/index.js';

vi.mock('../../src/adapters/index.js', () => ({
  resolveAdapters: vi.fn(),
  getAdapter: vi.fn(),
  getAllAdapters: vi.fn(),
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
}));

import { query } from '../../src/commands/query.js';
import { resolveAdapters } from '../../src/adapters/index.js';

function makeMockAdapter(data: unknown[] = [{ stat: 'value' }]) {
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

    const result = await query({
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
});
