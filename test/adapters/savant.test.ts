import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Mock http utils before importing adapter
vi.mock('../../src/utils/http.js', () => ({
  fetchText: vi.fn(),
  fetchJson: vi.fn(),
}));

// Mock logger to suppress output in tests
vi.mock('../../src/utils/logger.js', () => ({
  log: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), success: vi.fn(), error: vi.fn(), data: vi.fn() },
}));

import { SavantAdapter } from '../../src/adapters/savant.js';
import { fetchText, fetchJson } from '../../src/utils/http.js';

const sampleCsv = readFileSync(join(__dirname, '..', 'fixtures', 'savant-csv-sample.csv'), 'utf-8');
const mlbSearchFixture = JSON.parse(
  readFileSync(join(__dirname, '..', 'fixtures', 'mlb-people-search.json'), 'utf-8'),
);

describe('SavantAdapter', () => {
  let adapter: SavantAdapter;

  beforeEach(() => {
    adapter = new SavantAdapter();
    vi.clearAllMocks();
  });

  it('supports queries with player_name', () => {
    expect(adapter.supports({ player_name: 'Judge', season: 2025, stat_type: 'batting' })).toBe(true);
  });

  it('supports queries with date range', () => {
    expect(adapter.supports({
      season: 2025,
      stat_type: 'pitching',
      start_date: '2025-04-01',
      end_date: '2025-04-30',
    })).toBe(true);
  });

  it('does not support queries without player or date range', () => {
    expect(adapter.supports({ season: 2025, stat_type: 'batting' })).toBe(false);
  });

  it('resolves player via MLB Stats API', async () => {
    vi.mocked(fetchJson).mockResolvedValueOnce(mlbSearchFixture);

    const result = await adapter.resolvePlayer('Aaron Judge');
    expect(result).toEqual({
      mlbam_id: '592450',
      name: 'Aaron Judge',
      team: 'NYY',
      position: 'RF',
    });
  });

  it('fetches and parses Statcast CSV data', async () => {
    vi.mocked(fetchJson).mockResolvedValueOnce(mlbSearchFixture);
    vi.mocked(fetchText).mockResolvedValueOnce(sampleCsv);

    const result = await adapter.fetch({
      player_name: 'Corbin Burnes',
      season: 2025,
      stat_type: 'pitching',
    });

    expect(result.source).toBe('savant');
    expect(result.cached).toBe(false);
    // 13 total rows - 1 with empty pitch_type = 12 pitches
    expect(result.data.length).toBe(12);
    expect(result.meta.rowCount).toBe(12);
  });

  it('filters out rows with empty pitch_type', async () => {
    vi.mocked(fetchJson).mockResolvedValueOnce(mlbSearchFixture);
    vi.mocked(fetchText).mockResolvedValueOnce(sampleCsv);

    const result = await adapter.fetch({
      player_name: 'Corbin Burnes',
      season: 2025,
      stat_type: 'pitching',
    });

    const pitchTypes = result.data.map((p) => p.pitch_type);
    expect(pitchTypes.every((t) => t !== '')).toBe(true);
  });

  it('handles missing batter_name with Unknown (#ID) fallback', async () => {
    vi.mocked(fetchJson).mockResolvedValueOnce(mlbSearchFixture);
    vi.mocked(fetchText).mockResolvedValueOnce(sampleCsv);

    const result = await adapter.fetch({
      player_name: 'Corbin Burnes',
      season: 2025,
      stat_type: 'pitching',
    });

    // Rows 11-12 in CSV have empty batter_name
    const unknownBatters = result.data.filter((p) => p.batter_name.startsWith('Unknown'));
    expect(unknownBatters.length).toBe(2);
    expect(unknownBatters[0].batter_name).toMatch(/^Unknown \(#\d+\)$/);
  });

  it('returns empty data for "No Results" response', async () => {
    vi.mocked(fetchJson).mockResolvedValueOnce(mlbSearchFixture);
    vi.mocked(fetchText).mockResolvedValueOnce('No Results');

    const result = await adapter.fetch({
      player_name: 'Nonexistent Player',
      season: 2025,
      stat_type: 'pitching',
    });

    expect(result.data).toEqual([]);
    expect(result.meta.rowCount).toBe(0);
  });

  it('throws when player cannot be resolved', async () => {
    vi.mocked(fetchJson).mockResolvedValueOnce({ people: [] });

    await expect(
      adapter.fetch({
        player_name: 'Totally Fake Player',
        season: 2025,
        stat_type: 'pitching',
      }),
    ).rejects.toThrow('Player not found');
  });
});
