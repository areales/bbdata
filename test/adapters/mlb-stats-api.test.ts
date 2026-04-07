import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

vi.mock('../../src/utils/http.js', () => ({
  fetchText: vi.fn(),
  fetchJson: vi.fn(),
}));

vi.mock('../../src/utils/logger.js', () => ({
  log: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), success: vi.fn(), error: vi.fn(), data: vi.fn() },
}));

import { MlbStatsApiAdapter } from '../../src/adapters/mlb-stats-api.js';
import { fetchJson } from '../../src/utils/http.js';

const peopleFixture = JSON.parse(
  readFileSync(join(__dirname, '..', 'fixtures', 'mlb-people-search.json'), 'utf-8'),
);
const statsFixture = JSON.parse(
  readFileSync(join(__dirname, '..', 'fixtures', 'mlb-stats-season.json'), 'utf-8'),
);

describe('MlbStatsApiAdapter', () => {
  let adapter: MlbStatsApiAdapter;

  beforeEach(() => {
    adapter = new MlbStatsApiAdapter();
    vi.clearAllMocks();
  });

  it('supports all queries', () => {
    expect(adapter.supports({ season: 2025, stat_type: 'batting' })).toBe(true);
  });

  describe('resolvePlayer', () => {
    it('resolves a player by name', async () => {
      vi.mocked(fetchJson).mockResolvedValueOnce(peopleFixture);

      const result = await adapter.resolvePlayer('Aaron Judge');
      expect(result).toEqual({
        mlbam_id: '592450',
        name: 'Aaron Judge',
        team: 'NYY',
        position: 'RF',
      });
    });

    it('returns null when no player found', async () => {
      vi.mocked(fetchJson).mockResolvedValueOnce({ people: [] });

      const result = await adapter.resolvePlayer('Nobody');
      expect(result).toBeNull();
    });

    it('returns null on API error', async () => {
      vi.mocked(fetchJson).mockRejectedValueOnce(new Error('API down'));

      const result = await adapter.resolvePlayer('Aaron Judge');
      expect(result).toBeNull();
    });
  });

  describe('fetch', () => {
    it('fetches season stats for a player', async () => {
      vi.mocked(fetchJson)
        .mockResolvedValueOnce(peopleFixture)  // resolvePlayer
        .mockResolvedValueOnce(statsFixture);   // fetch stats

      const result = await adapter.fetch({
        player_name: 'Aaron Judge',
        season: 2025,
        stat_type: 'batting',
      });

      expect(result.source).toBe('mlb-stats-api');
      expect(result.data.length).toBe(1);
      expect(result.data[0].player_name).toBe('Aaron Judge');
      expect(result.data[0].stats.homeRuns).toBe(52);
      expect(result.data[0].season).toBe(2025);
    });

    it('throws when player cannot be resolved', async () => {
      vi.mocked(fetchJson).mockResolvedValueOnce({ people: [] });

      await expect(
        adapter.fetch({
          player_name: 'Fake Player',
          season: 2025,
          stat_type: 'batting',
        }),
      ).rejects.toThrow('Player not found');
    });
  });
});
