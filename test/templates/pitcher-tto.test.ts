import { describe, it, expect } from 'vitest';
import type { PitchData } from '../../src/adapters/types.js';

import '../../src/templates/queries/index.js';
import { getTemplate } from '../../src/templates/queries/registry.js';

describe('pitcher-tto template', () => {
  const template = getTemplate('pitcher-tto')!;

  it('is registered', () => {
    expect(template).toBeDefined();
    expect(template.id).toBe('pitcher-tto');
    expect(template.category).toBe('pitcher');
  });

  it('emits exactly 3 rows in order (1st / 2nd / 3rd+)', () => {
    // 12 unique batters, one PA each → 12 PAs → TTO 1 for all 12
    // (9 would fill TTO 1, the next 3 would go to TTO 2, none to 3+)
    // But we want to exercise all three buckets, so use fewer batters with repeat PAs.
    const pitches = batterLineup(['A', 'B', 'C'], 4); // A,B,C,A,B,C,A,B,C,A,B,C → TTO 1/1/1/2/2/2/3/3/3/4/4/4
    const rows = template.transform(pitches, { player: 'Test' });
    expect(rows).toHaveLength(3);
    expect(rows[0]!.Pass).toBe('1st TTO');
    expect(rows[1]!.Pass).toBe('2nd TTO');
    expect(rows[2]!.Pass).toBe('3rd+ TTO');
  });

  it('assigns TTO based on batter appearance count per game', () => {
    // 3 batters × 3 appearances each = 9 PAs
    // TTO1: A1, B1, C1 → 3 PAs
    // TTO2: A2, B2, C2 → 3 PAs
    // TTO3+: A3, B3, C3 → 3 PAs
    const pitches = batterLineup(['A', 'B', 'C'], 3);
    const rows = template.transform(pitches, { player: 'Test' });
    expect(rows[0]!.PAs).toBe(3);
    expect(rows[1]!.PAs).toBe(3);
    expect(rows[2]!.PAs).toBe(3);
  });

  it('collapses 3rd, 4th, 5th+ appearances into the 3rd+ bucket', () => {
    // 1 batter with 5 PAs: TTO1, TTO2, TTO3+, TTO3+, TTO3+
    const pitches = batterLineup(['A'], 5);
    const rows = template.transform(pitches, { player: 'Test' });
    expect(rows[0]!.PAs).toBe(1); // TTO1
    expect(rows[1]!.PAs).toBe(1); // TTO2
    expect(rows[2]!.PAs).toBe(3); // TTO3+ (3rd, 4th, 5th)
  });

  it('resets TTO per game_date (handles doubleheaders)', () => {
    // Same batter, 2 games, 1 PA each. Both should be TTO1.
    const pitches: PitchData[] = [
      makePitch({
        game_date: '2024-05-01',
        batter_id: 'A',
        at_bat_number: 1,
        events: 'field_out',
      }),
      makePitch({
        game_date: '2024-05-02',
        batter_id: 'A',
        at_bat_number: 1,
        events: 'field_out',
      }),
    ];
    const rows = template.transform(pitches, { player: 'Test' });
    expect(rows[0]!.PAs).toBe(2); // both in TTO1
    expect(rows[1]!.PAs).toBe(0); // nothing in TTO2
  });

  it('skips pitches with null at_bat_number', () => {
    const pitches: PitchData[] = [
      makePitch({
        game_date: '2024-05-01',
        batter_id: 'A',
        at_bat_number: null,
        events: 'field_out',
      }),
    ];
    expect(template.transform(pitches, { player: 'Test' })).toEqual([]);
  });

  it('computes K% and BB% over PAs in the bucket', () => {
    // 3 PAs in TTO1: 1 strikeout, 1 walk, 1 field_out
    const pitches: PitchData[] = [
      makePitch({
        game_date: '2024-05-01',
        batter_id: 'A',
        at_bat_number: 1,
        events: 'strikeout',
      }),
      makePitch({
        game_date: '2024-05-01',
        batter_id: 'B',
        at_bat_number: 2,
        events: 'walk',
      }),
      makePitch({
        game_date: '2024-05-01',
        batter_id: 'C',
        at_bat_number: 3,
        events: 'field_out',
      }),
    ];
    const rows = template.transform(pitches, { player: 'Test' });
    expect(rows[0]!['K %']).toBe('33.3%');
    expect(rows[0]!['BB %']).toBe('33.3%');
  });
});

function makePitch(overrides: Partial<PitchData> = {}): PitchData {
  return {
    pitcher_id: '669373',
    pitcher_name: 'Test Pitcher',
    batter_id: 'B1',
    batter_name: 'Test Batter',
    game_date: '2024-05-01',
    pitch_type: 'FF',
    release_speed: 95,
    release_spin_rate: 2400,
    pfx_x: 0.5,
    pfx_z: 1.3,
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
    at_bat_number: 1,
    pitch_number: null,
    ...overrides,
  };
}

/**
 * Build a synthetic lineup: `rounds` rotations through the given batter
 * list, each PA with a PA-ending `field_out` event. at_bat_number is
 * assigned sequentially across the game.
 */
function batterLineup(batters: string[], rounds: number): PitchData[] {
  const pitches: PitchData[] = [];
  let atBat = 1;
  for (let r = 0; r < rounds; r++) {
    for (const b of batters) {
      pitches.push(
        makePitch({
          game_date: '2024-05-01',
          batter_id: b,
          at_bat_number: atBat,
          events: 'field_out',
        }),
      );
      atBat += 1;
    }
  }
  return pitches;
}
