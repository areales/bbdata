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

import { FanGraphsAdapter } from '../../src/adapters/fangraphs.js';
import { fetchText } from '../../src/utils/http.js';

const sampleJson = readFileSync(join(__dirname, '..', 'fixtures', 'fangraphs-leaders-sample.json'), 'utf-8');

describe('FanGraphsAdapter', () => {
  let adapter: FanGraphsAdapter;

  beforeEach(() => {
    adapter = new FanGraphsAdapter();
    vi.clearAllMocks();
  });

  describe('resolvePlayer', () => {
    it('finds exact name match', async () => {
      vi.mocked(fetchText).mockResolvedValueOnce(sampleJson);

      const result = await adapter.resolvePlayer('Aaron Judge');
      expect(result).not.toBeNull();
      expect(result!.name).toBe('Aaron Judge');
      expect(result!.mlbam_id).toBe('592450');
      expect(result!.fangraphs_id).toBe('17109');
    });

    it('finds player with case-insensitive match', async () => {
      vi.mocked(fetchText).mockResolvedValueOnce(sampleJson);

      const result = await adapter.resolvePlayer('aaron judge');
      expect(result).not.toBeNull();
      expect(result!.name).toBe('Aaron Judge');
    });

    it('falls back to token-based fuzzy match', async () => {
      vi.mocked(fetchText).mockResolvedValueOnce(sampleJson);

      // "Mookie" should match "Mookie Betts" via token starts-with
      const result = await adapter.resolvePlayer('Mookie');
      expect(result).not.toBeNull();
      expect(result!.name).toBe('Mookie Betts');
    });

    it('does not match partial tokens incorrectly', async () => {
      vi.mocked(fetchText).mockResolvedValueOnce(sampleJson);

      // "Jo" should match "Jo Adell" (token "jo" starts "jo")
      // but should NOT match "Aaron Judge" (no token starts with "jo")
      const result = await adapter.resolvePlayer('Jo');
      expect(result).not.toBeNull();
      expect(result!.name).toBe('Jo Adell');
    });

    it('returns null when no match found', async () => {
      vi.mocked(fetchText).mockResolvedValueOnce(sampleJson);

      const result = await adapter.resolvePlayer('Nonexistent Player');
      expect(result).toBeNull();
    });

    it('returns null on API error', async () => {
      vi.mocked(fetchText).mockRejectedValueOnce(new Error('Network error'));

      const result = await adapter.resolvePlayer('Aaron Judge');
      expect(result).toBeNull();
    });
  });

  describe('fetch', () => {
    it('fetches and returns player stats', async () => {
      vi.mocked(fetchText).mockResolvedValueOnce(sampleJson);

      const result = await adapter.fetch({
        player_name: 'Aaron Judge',
        season: 2025,
        stat_type: 'batting',
      });

      expect(result.source).toBe('fangraphs');
      expect(result.data.length).toBe(1);
      expect(result.data[0].player_name).toBe('Aaron Judge');
      expect(result.data[0].stats.HR).toBe(52);
    });

    it('returns all players when no player_name filter', async () => {
      vi.mocked(fetchText).mockResolvedValueOnce(sampleJson);

      const result = await adapter.fetch({
        season: 2025,
        stat_type: 'batting',
      });

      expect(result.data.length).toBe(5);
    });

    it('uses exact match for player filter in fetch', async () => {
      vi.mocked(fetchText).mockResolvedValueOnce(sampleJson);

      const result = await adapter.fetch({
        player_name: 'Jo Adell',
        season: 2025,
        stat_type: 'batting',
      });

      expect(result.data.length).toBe(1);
      expect(result.data[0].player_name).toBe('Jo Adell');
    });

    it('fetches a season range with season1 + ind=1 and maps per-row seasons (P1.9)', async () => {
      const rangeJson = JSON.stringify({
        data: [
          { PlayerName: 'Corbin Carroll', xMLBAMID: 682998, Season: 2025, AVG: 0.259, HR: 31 },
          { PlayerName: 'Corbin Carroll', xMLBAMID: 682998, Season: 2024, AVG: 0.231, HR: 22 },
        ],
      });
      vi.mocked(fetchText).mockResolvedValueOnce(rangeJson);

      const result = await adapter.fetch({
        player_name: 'Corbin Carroll',
        season: 2025,
        start_season: 2024,
        stat_type: 'batting',
      });

      // URL carries the range params, split-by-season mode, and a page
      // wide enough that a qual=0 multi-season pull isn't truncated.
      const url = vi.mocked(fetchText).mock.calls[0]?.[0] as string;
      expect(url).toContain('season=2025');
      expect(url).toContain('season1=2024');
      expect(url).toContain('ind=1');
      expect(url).toContain('pageitems=2000');

      expect(result.data).toHaveLength(2);
      const seasons = result.data.map((p) => p.season).sort();
      expect(seasons).toEqual([2024, 2025]);
    });

    it('keeps single-season fetches on ind=0 with the default page size', async () => {
      vi.mocked(fetchText).mockResolvedValueOnce(sampleJson);

      await adapter.fetch({ season: 2025, stat_type: 'batting' });

      const url = vi.mocked(fetchText).mock.calls[0]?.[0] as string;
      expect(url).toContain('ind=0');
      expect(url).toContain('season1=2025');
      expect(url).toContain('pageitems=500');
    });
  });
});
