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

  it('post-parse filters out non-regular-season rows (BBDATA-007 defense-in-depth)', async () => {
    vi.mocked(fetchJson).mockResolvedValueOnce(mlbSearchFixture);
    // Construct a tiny CSV with both R (regular) and S (spring training) rows.
    // Even if Savant's hfGT filter ever regresses, the adapter must still drop
    // non-R rows before handing data to templates.
    const mixedCsv =
      'pitch_type,game_date,release_speed,release_spin_rate,pfx_x,pfx_z,plate_x,plate_z,player_name,pitcher,batter,batter_name,description,events,bb_type,stand,p_throws,launch_speed,launch_angle,hc_x,hc_y,estimated_ba_using_speedangle,estimated_woba_using_speedangle,game_type\n' +
      'FF,2025-03-15,95.0,2300,0.5,1.0,0,2.5,Pitcher A,111,592450,Aaron Judge,ball,,,R,R,,,,,,,S\n' +
      'FF,2025-04-01,96.0,2400,0.6,1.1,0,2.5,Pitcher B,222,592450,Aaron Judge,ball,,,R,R,,,,,,,R\n' +
      'SL,2025-04-02,87.5,2500,-1.2,0.5,0.2,2.0,Pitcher C,333,592450,Aaron Judge,called_strike,,,R,R,,,,,,,R\n';
    vi.mocked(fetchText).mockResolvedValueOnce(mixedCsv);

    const result = await adapter.fetch({
      player_name: 'Aaron Judge',
      season: 2025,
      stat_type: 'batting',
    });

    // Only the 2 R rows should survive; the 2025-03-15 S row must be dropped.
    expect(result.data.length).toBe(2);
    expect(result.data.every((p) => p.game_date !== '2025-03-15')).toBe(true);
  });

  it('restricts queries to regular-season games via hfGT=R| (BBDATA-007)', async () => {
    vi.mocked(fetchJson).mockResolvedValueOnce(mlbSearchFixture);
    vi.mocked(fetchText).mockResolvedValueOnce(sampleCsv);

    await adapter.fetch({
      player_name: 'Aaron Judge',
      season: 2025,
      stat_type: 'batting',
    });

    // The first fetchText call receives the Savant CSV search URL as its first arg.
    // `|` URL-encodes as `%7C`, so the param appears as `hfGT=R%7C`.
    const url = vi.mocked(fetchText).mock.calls[0]?.[0];
    expect(url).toBeDefined();
    expect(url).toContain('hfGT=R%7C');
  });

  it('maps inning/balls/strikes/outs_when_up/at_bat_number/pitch_number from CSV (BBDATA-011)', async () => {
    vi.mocked(fetchJson).mockResolvedValueOnce(mlbSearchFixture);
    // Mini CSV with the 6 new columns. Row 1 has balls=0/strikes=0 (valid
    // zeros that must NOT coerce to null); row 2 has everything blank
    // (must degrade to null); row 3 has a full count late in a game.
    const csv =
      'pitch_type,game_date,release_speed,release_spin_rate,pfx_x,pfx_z,plate_x,plate_z,player_name,pitcher,batter,batter_name,description,events,bb_type,stand,p_throws,launch_speed,launch_angle,hc_x,hc_y,estimated_ba_using_speedangle,estimated_woba_using_speedangle,game_type,inning,balls,strikes,outs_when_up,at_bat_number,pitch_number\n' +
      'FF,2025-04-15,95.2,2350,0.8,1.2,-0.3,2.8,Pitcher A,111,592450,Aaron Judge,called_strike,,,R,R,,,,,,,R,1,0,0,0,1,1\n' +
      'SL,2025-04-15,87.1,2680,-0.5,0.4,0.1,1.9,Pitcher A,111,592450,Aaron Judge,ball,,,R,R,,,,,,,R,,,,,,\n' +
      'FC,2025-04-15,91.3,2500,0.2,0.9,0.0,2.3,Pitcher A,111,592450,Aaron Judge,swinging_strike,,,R,R,,,,,,,R,7,3,2,2,27,6\n';
    vi.mocked(fetchText).mockResolvedValueOnce(csv);

    const result = await adapter.fetch({
      player_name: 'Aaron Judge',
      season: 2025,
      stat_type: 'batting',
    });

    expect(result.data).toHaveLength(3);

    const row1 = result.data[0]!;
    // Legitimate zeros must be preserved (0 balls, 0 strikes, 0 outs is the
    // count state at the start of every game) — the prior `|| null` idiom
    // would have silently nulled these out.
    expect(row1.inning).toBe(1);
    expect(row1.balls).toBe(0);
    expect(row1.strikes).toBe(0);
    expect(row1.outs_when_up).toBe(0);
    expect(row1.at_bat_number).toBe(1);
    expect(row1.pitch_number).toBe(1);

    const row2 = result.data[1]!;
    // Empty cells degrade cleanly to null.
    expect(row2.inning).toBeNull();
    expect(row2.balls).toBeNull();
    expect(row2.strikes).toBeNull();
    expect(row2.outs_when_up).toBeNull();
    expect(row2.at_bat_number).toBeNull();
    expect(row2.pitch_number).toBeNull();

    const row3 = result.data[2]!;
    expect(row3.inning).toBe(7);
    expect(row3.balls).toBe(3);
    expect(row3.strikes).toBe(2);
    expect(row3.outs_when_up).toBe(2);
    expect(row3.at_bat_number).toBe(27);
    expect(row3.pitch_number).toBe(6);
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
