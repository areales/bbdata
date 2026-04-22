import { describe, it, expect } from 'vitest';
import type { PitchData } from '../../src/adapters/types.js';

import '../../src/templates/queries/index.js';
import { getTemplate } from '../../src/templates/queries/registry.js';

describe('pitcher-rolling-trend template', () => {
  const template = getTemplate('pitcher-rolling-trend')!;

  it('is registered under the trend category', () => {
    expect(template).toBeDefined();
    expect(template.id).toBe('pitcher-rolling-trend');
    expect(template.category).toBe('trend');
  });

  it('buildQuery returns a pitching query', () => {
    const query = template.buildQuery({ player: 'Gerrit Cole', season: 2024 });
    expect(query.player_name).toBe('Gerrit Cole');
    expect(query.stat_type).toBe('pitching');
    expect(query.season).toBe(2024);
  });

  it('returns empty array for no data', () => {
    expect(template.transform([], { player: 'Cole' })).toEqual([]);
  });

  it('returns an insufficient-data row when fewer than `window` qualifying starts', () => {
    const pitches: PitchData[] = [];
    // 3 starts of 15 pitches each — below the default window of 5.
    for (let day = 1; day <= 3; day++) {
      const date = `2024-04-0${day}`;
      for (let p = 0; p < 15; p++) {
        pitches.push(makePitch({ game_date: date }));
      }
    }
    const rows = template.transform(pitches, { player: 'Cole' });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.Window).toBe('Insufficient data');
    expect(rows[0]!.Starts).toBe(3);
  });

  it('excludes outings with fewer than 10 pitches (filters position-player / 1-batter relief)', () => {
    // 5 "real" starts + 1 junk 3-pitch outing. Junk outing is silently dropped,
    // which leaves exactly `window` starts so a single rolling row is emitted.
    const pitches: PitchData[] = [];
    for (let day = 1; day <= 5; day++) {
      const date = `2024-04-0${day}`;
      for (let p = 0; p < 20; p++) {
        pitches.push(makePitch({ game_date: date }));
      }
    }
    for (let p = 0; p < 3; p++) {
      pitches.push(makePitch({ game_date: '2024-04-06' }));
    }
    const rows = template.transform(pitches, { player: 'Cole' });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.Starts).toBe(5);
    expect(rows[0]!['Window End']).toBe('2024-04-05');
  });

  it('slides the window with step = max(1, floor(window/3)) and produces multiple rows', () => {
    // 7 starts with window=5 → step=1 → rows for ending dates 04-05, 04-06, 04-07.
    const pitches: PitchData[] = [];
    for (let day = 1; day <= 7; day++) {
      const date = `2024-04-0${day}`;
      for (let p = 0; p < 20; p++) {
        pitches.push(makePitch({ game_date: date }));
      }
    }
    const rows = template.transform(pitches, { player: 'Cole' });
    expect(rows).toHaveLength(3);
    expect(rows[0]!['Window End']).toBe('2024-04-05');
    expect(rows[1]!['Window End']).toBe('2024-04-06');
    expect(rows[2]!['Window End']).toBe('2024-04-07');
  });

  it('computes Avg Velo from fastball-family pitches only', () => {
    const pitches: PitchData[] = [];
    for (let day = 1; day <= 5; day++) {
      const date = `2024-04-0${day}`;
      for (let p = 0; p < 10; p++) {
        pitches.push(makePitch({ game_date: date, pitch_type: 'FF', release_speed: 96 }));
        pitches.push(makePitch({ game_date: date, pitch_type: 'SL', release_speed: 85 })); // excluded
      }
    }
    const rows = template.transform(pitches, { player: 'Cole' });
    expect(rows[0]!['Avg Velo']).toBe('96.0 mph');
  });

  it('computes Whiff % as whiffs / swings', () => {
    const pitches: PitchData[] = [];
    // 5 starts × 10 pitches each — 5 swinging_strike + 5 foul per start.
    for (let day = 1; day <= 5; day++) {
      const date = `2024-04-0${day}`;
      for (let p = 0; p < 5; p++) {
        pitches.push(makePitch({ game_date: date, description: 'swinging_strike' }));
      }
      for (let p = 0; p < 5; p++) {
        pitches.push(makePitch({ game_date: date, description: 'foul' }));
      }
    }
    const rows = template.transform(pitches, { player: 'Cole' });
    // 25 whiffs / 50 swings = 50.0%
    expect(rows[0]!['Whiff %']).toBe('50.0%');
  });

  it('computes CSW % as (called_strike + swinging_strike) / total pitches', () => {
    const pitches: PitchData[] = [];
    for (let day = 1; day <= 5; day++) {
      const date = `2024-04-0${day}`;
      for (let p = 0; p < 2; p++) {
        pitches.push(makePitch({ game_date: date, description: 'called_strike' }));
      }
      for (let p = 0; p < 3; p++) {
        pitches.push(makePitch({ game_date: date, description: 'swinging_strike' }));
      }
      for (let p = 0; p < 5; p++) {
        pitches.push(makePitch({ game_date: date, description: 'ball' }));
      }
    }
    const rows = template.transform(pitches, { player: 'Cole' });
    // (10 called + 15 swinging) / 50 total = 50.0%
    expect(rows[0]!['CSW %']).toBe('50.0%');
  });

  it('computes K % as strikeouts / PAs', () => {
    const pitches: PitchData[] = [];
    for (let day = 1; day <= 5; day++) {
      const date = `2024-04-0${day}`;
      // 2 strikeouts + 2 walks + 6 non-terminal pitches (events=null) per start
      for (let p = 0; p < 2; p++) {
        pitches.push(makePitch({ game_date: date, events: 'strikeout' }));
      }
      for (let p = 0; p < 2; p++) {
        pitches.push(makePitch({ game_date: date, events: 'walk' }));
      }
      for (let p = 0; p < 6; p++) {
        pitches.push(makePitch({ game_date: date, events: null }));
      }
    }
    const rows = template.transform(pitches, { player: 'Cole' });
    // 10 K / 20 PA = 50.0%
    expect(rows[0]!['K %']).toBe('50.0%');
  });

  it('honors a custom window via params', () => {
    const pitches: PitchData[] = [];
    for (let day = 1; day <= 4; day++) {
      const date = `2024-04-0${day}`;
      for (let p = 0; p < 10; p++) {
        pitches.push(makePitch({ game_date: date }));
      }
    }
    // 4 starts, window=3 → step=1 → 2 rows (04-03, 04-04)
    const rows = template.transform(pitches, { player: 'Cole', window: 3 });
    expect(rows).toHaveLength(2);
    expect(rows[0]!['Window End']).toBe('2024-04-03');
    expect(rows[1]!['Window End']).toBe('2024-04-04');
  });
});

function makePitch(overrides: Partial<PitchData> = {}): PitchData {
  return {
    pitcher_id: '543037',
    pitcher_name: 'Gerrit Cole',
    batter_id: '592450',
    batter_name: 'Aaron Judge',
    game_date: '2024-04-15',
    pitch_type: 'FF',
    release_speed: 96,
    release_spin_rate: 2450,
    pfx_x: 0.6,
    pfx_z: 1.4,
    plate_x: 0,
    plate_z: 2.5,
    launch_speed: null,
    launch_angle: null,
    hc_x: null,
    hc_y: null,
    description: 'called_strike',
    events: null,
    bb_type: null,
    stand: 'R',
    p_throws: 'R',
    estimated_ba: null,
    estimated_woba: null,
    inning: null,
    balls: null,
    strikes: null,
    outs_when_up: null,
    at_bat_number: null,
    pitch_number: null,
    ...overrides,
  };
}
