import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadDataFile } from '../../src/utils/data-input.js';
import { parseSavantCsv } from '../../src/adapters/savant-csv.js';

const SAVANT_CSV = `pitch_type,game_date,release_speed,release_spin_rate,pfx_x,pfx_z,plate_x,plate_z,player_name,pitcher,batter,batter_name,description,events,bb_type,stand,p_throws,launch_speed,launch_angle,hc_x,hc_y,estimated_ba_using_speedangle,estimated_woba_using_speedangle,inning,balls,strikes,outs_when_up,at_bat_number,pitch_number,game_type
FF,2025-04-15,95.2,2350,0.8,1.2,-0.3,2.8,Burnes Corbin,669203,592450,Aaron Judge,called_strike,,,R,R,,,,,,,1,0,0,0,1,1,R
SL,2025-04-15,87.1,2680,-0.5,0.4,0.1,1.9,Burnes Corbin,669203,592450,Aaron Judge,hit_into_play,single,ground_ball,R,R,92.5,8.3,145.2,98.7,0.45,0.42,1,1,1,0,1,2,R
,2025-04-15,0,0,0,0,0,0,Burnes Corbin,669203,592450,Aaron Judge,intent_ball,,,R,R,,,,,,,1,1,0,0,1,3,R
FF,2025-03-01,94.8,2320,0.7,1.3,0.2,2.5,Burnes Corbin,669203,592450,Aaron Judge,called_strike,,,R,R,,,,,,,1,0,0,0,1,1,S
`;

describe('parseSavantCsv', () => {
  it('maps CSV columns to PitchData', () => {
    const rows = parseSavantCsv(SAVANT_CSV);
    // Filters: empty pitch_type + non-R game_type drop 2 of 4 rows.
    expect(rows).toHaveLength(2);
    expect(rows[0].pitcher_id).toBe('669203');
    expect(rows[0].pitch_type).toBe('FF');
    expect(rows[0].release_speed).toBe(95.2);
    expect(rows[1].launch_speed).toBe(92.5);
    expect(rows[1].balls).toBe(1);
    expect(rows[1].outs_when_up).toBe(0);
  });

  it('preserves legitimate zeros in count/inning fields', () => {
    const rows = parseSavantCsv(SAVANT_CSV);
    // First data row has balls=0, strikes=0, outs_when_up=0 — must survive
    // the zero-vs-null distinction.
    expect(rows[0].balls).toBe(0);
    expect(rows[0].strikes).toBe(0);
    expect(rows[0].outs_when_up).toBe(0);
  });
});

describe('loadDataFile', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'bbdata-data-input-'));
  });

  it('loads a .json file with wrapper shape', () => {
    const path = join(tmp, 'payload.json');
    const payload = {
      data: [{ pitcher_id: '123', pitcher_name: 'Test', pitch_type: 'FF' }],
      player: { mlbam_id: '123', name: 'Test' },
    };
    writeFileSync(path, JSON.stringify(payload));
    const adapter = loadDataFile(path);
    expect(adapter.supports({} as any)).toBe(true);
  });

  it('loads a .json file with raw array shape', () => {
    const path = join(tmp, 'arr.json');
    writeFileSync(path, JSON.stringify([{ pitcher_id: '1', pitch_type: 'SL' }]));
    const adapter = loadDataFile(path);
    expect(adapter.supports({} as any)).toBe(true);
  });

  it('loads a .csv file and parses via Savant schema', async () => {
    const path = join(tmp, 'savant.csv');
    writeFileSync(path, SAVANT_CSV);
    const adapter = loadDataFile(path);
    const result = await adapter.fetch({ season: 2025 } as any);
    expect(result.data).toHaveLength(2);
    expect((result.data[0] as any).pitch_type).toBe('FF');
  });

  it('returns independent adapter instances across calls (no singleton state leak)', () => {
    const pathA = join(tmp, 'a.json');
    const pathB = join(tmp, 'b.json');
    writeFileSync(pathA, JSON.stringify([{ pitcher_id: 'A', pitch_type: 'FF' }]));
    writeFileSync(pathB, JSON.stringify([]));
    const adapterA = loadDataFile(pathA);
    const adapterB = loadDataFile(pathB);
    // Each call returns its own instance; loading B must not touch A's data.
    expect(adapterA).not.toBe(adapterB);
    expect(adapterA.supports({} as any)).toBe(true);
    expect(adapterB.supports({} as any)).toBe(false);
  });

  it('rejects unsupported extensions', () => {
    const path = join(tmp, 'bad.txt');
    writeFileSync(path, 'hello');
    expect(() => loadDataFile(path)).toThrow(/Unsupported --data extension/);
  });

  it('is case-insensitive on extension', () => {
    const path = join(tmp, 'upper.JSON');
    writeFileSync(path, '[]');
    expect(() => loadDataFile(path)).not.toThrow();
  });
});
