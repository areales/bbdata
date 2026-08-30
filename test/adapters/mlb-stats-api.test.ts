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

    it('fetches season + statSplits and tags split rows when sit_codes present (P2.7)', async () => {
      const splitsFixture = {
        stats: [
          {
            splits: [
              { stat: { plateAppearances: 627, avg: '.295' }, season: '2025' },
            ],
          },
          {
            splits: [
              {
                stat: { plateAppearances: 161, avg: '.323' },
                season: '2025',
                split: { code: 'risp', description: 'Scoring Position' },
              },
              {
                stat: { plateAppearances: 336, avg: '.270' },
                season: '2025',
                split: { code: 'r0', description: 'Bases Empty' },
              },
            ],
          },
        ],
      };
      vi.mocked(fetchJson)
        .mockResolvedValueOnce(peopleFixture)   // resolvePlayer
        .mockResolvedValueOnce(splitsFixture);  // fetch stats

      const result = await adapter.fetch({
        player_name: 'Aaron Judge',
        season: 2025,
        stat_type: 'batting',
        sit_codes: ['risp', 'r0'],
      });

      const url = vi.mocked(fetchJson).mock.calls[1]?.[0] as string;
      expect(url).toContain('stats=season,statSplits');
      expect(url).toContain('sitCodes=risp,r0');

      expect(result.data).toHaveLength(3);
      expect(result.data[0].split).toBeUndefined(); // season aggregate
      expect(result.data[1].split).toEqual({ code: 'risp', description: 'Scoring Position' });
      expect(result.data[2].split).toEqual({ code: 'r0', description: 'Bases Empty' });
    });

    it('ignores sit_codes on the leaderboard path (no player)', async () => {
      vi.mocked(fetchJson).mockResolvedValueOnce(statsFixture);

      await adapter.fetch({
        season: 2025,
        stat_type: 'batting',
        sit_codes: ['risp'],
      });

      const url = vi.mocked(fetchJson).mock.calls[0]?.[0] as string;
      expect(url).toContain('stats=season');
      expect(url).not.toContain('statSplits');
    });
  });
});
