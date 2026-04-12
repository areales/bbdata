import { describe, it, expect } from 'vitest';
import type { PitchData } from '../../src/adapters/types.js';

import '../../src/templates/queries/index.js';
import { getTemplate } from '../../src/templates/queries/registry.js';

describe('pitcher-by-count template', () => {
  const template = getTemplate('pitcher-by-count')!;

  it('is registered as a pitcher template', () => {
    expect(template).toBeDefined();
    expect(template.id).toBe('pitcher-by-count');
    expect(template.category).toBe('pitcher');
  });

  it('emits 4 rows in fixed order (Ahead / Even / Behind / Two-strike overlay)', () => {
    const pitches: PitchData[] = [
      // 1 ahead (0-1)
      makePitch({ balls: 0, strikes: 1, description: 'called_strike' }),
      // 2 even (1-1, 0-0)
      makePitch({ balls: 1, strikes: 1, description: 'ball' }),
      makePitch({ balls: 0, strikes: 0, description: 'called_strike' }),
      // 1 behind (2-1)
      makePitch({ balls: 2, strikes: 1, description: 'ball' }),
    ];
    const rows = template.transform(pitches, { player: 'Skubal' });
    expect(rows).toHaveLength(4);
    expect(rows[0]!['Count State']).toBe('Ahead');
    expect(rows[1]!['Count State']).toBe('Even');
    expect(rows[2]!['Count State']).toBe('Behind');
    expect(rows[3]!['Count State']).toBe('Two-strike (overlay)');
  });

  it('non-overlay usage % sums to 100% across Ahead/Even/Behind', () => {
    const pitches: PitchData[] = [
      // 2 ahead
      makePitch({ balls: 0, strikes: 1 }),
      makePitch({ balls: 1, strikes: 2 }),
      // 1 even
      makePitch({ balls: 0, strikes: 0 }),
      // 1 behind
      makePitch({ balls: 2, strikes: 0 }),
    ];
    const rows = template.transform(pitches, { player: 'Skubal' });
    const ahead = parseFloat((rows[0]!['Usage %'] as string).replace('%', ''));
    const even = parseFloat((rows[1]!['Usage %'] as string).replace('%', ''));
    const behind = parseFloat((rows[2]!['Usage %'] as string).replace('%', ''));
    expect(ahead + even + behind).toBeCloseTo(100, 1);
  });

  it('two-strike overlay is counted separately (not subtracted from non-overlay)', () => {
    const pitches: PitchData[] = [
      // 1 ahead with 2 strikes (counted in both Ahead AND Two-strike)
      makePitch({ balls: 0, strikes: 2 }),
      // 1 even with 2 strikes (counted in both Even AND Two-strike)
      makePitch({ balls: 2, strikes: 2 }),
      // 1 behind with 1 strike (only in Behind)
      makePitch({ balls: 2, strikes: 1 }),
    ];
    const rows = template.transform(pitches, { player: 'Skubal' });
    // Non-overlay: 1 ahead + 1 even + 1 behind — all 1 pitch each
    expect(rows[0]!.Pitches).toBe(1); // Ahead
    expect(rows[1]!.Pitches).toBe(1); // Even
    expect(rows[2]!.Pitches).toBe(1); // Behind
    // Overlay: 2 pitches had 2 strikes
    expect(rows[3]!.Pitches).toBe(2); // Two-strike
  });

  it('skips rows with null balls/strikes', () => {
    const pitches: PitchData[] = [
      makePitch({ balls: null, strikes: 1 }),
      makePitch({ balls: 0, strikes: null }),
      makePitch({ balls: 0, strikes: 1 }), // valid — ahead
    ];
    const rows = template.transform(pitches, { player: 'Skubal' });
    expect(rows[0]!.Pitches).toBe(1);
    expect(rows[1]!.Pitches).toBe(0);
    expect(rows[2]!.Pitches).toBe(0);
  });

  it('computes whiff % only over swings (not all pitches)', () => {
    const pitches: PitchData[] = [
      // Ahead: 1 whiff, 1 foul (2 swings), 1 called strike (not a swing)
      makePitch({ balls: 0, strikes: 1, description: 'swinging_strike' }),
      makePitch({ balls: 0, strikes: 1, description: 'foul' }),
      makePitch({ balls: 0, strikes: 1, description: 'called_strike' }),
    ];
    const rows = template.transform(pitches, { player: 'Skubal' });
    // 1 whiff / 2 swings = 50.0%
    expect(rows[0]!['Whiff %']).toBe('50.0%');
  });

  it('picks primary pitch as the mode within a bucket', () => {
    const pitches: PitchData[] = [
      // Behind bucket: 3 FF, 1 SL → primary FF
      makePitch({ balls: 2, strikes: 0, pitch_type: 'FF' }),
      makePitch({ balls: 2, strikes: 0, pitch_type: 'FF' }),
      makePitch({ balls: 2, strikes: 0, pitch_type: 'FF' }),
      makePitch({ balls: 2, strikes: 0, pitch_type: 'SL' }),
    ];
    const rows = template.transform(pitches, { player: 'Skubal' });
    expect(rows[2]!['Primary Pitch']).toContain('Fastball');
  });

  it('returns empty array when no pitches have count data', () => {
    const pitches: PitchData[] = [
      makePitch({ balls: null, strikes: null }),
    ];
    expect(template.transform(pitches, { player: 'Skubal' })).toEqual([]);
  });
});

function makePitch(overrides: Partial<PitchData> = {}): PitchData {
  return {
    pitcher_id: '669373',
    pitcher_name: 'Tarik Skubal',
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
    p_throws: 'L',
    estimated_ba: null,
    estimated_woba: null,
    inning: null,
    balls: 0,
    strikes: 0,
    outs_when_up: null,
    at_bat_number: null,
    pitch_number: null,
    ...overrides,
  };
}
