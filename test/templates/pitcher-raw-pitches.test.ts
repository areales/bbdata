import { describe, it, expect } from 'vitest';
import type { PitchData } from '../../src/adapters/types.js';

import '../../src/templates/queries/index.js';
import { getTemplate } from '../../src/templates/queries/registry.js';

const template = getTemplate('pitcher-raw-pitches')!;

describe('pitcher-raw-pitches template', () => {
  it('passes count state and release point through (P4.11)', () => {
    // These columns power the course's Pitch Mix by Count and Release
    // Point Plot templates, which previously required a raw Savant export.
    const input = [
      {
        pitcher_id: '669373',
        pitcher_name: 'Tarik Skubal',
        batter_id: '1',
        batter_name: 'Batter',
        game_date: '2025-06-01',
        pitch_type: 'FF',
        release_speed: 97.5,
        release_spin_rate: 2350,
        release_pos_x: -2.03,
        release_pos_z: 5.85,
        pfx_x: 0.5,
        pfx_z: 1.4,
        plate_x: 0.1,
        plate_z: 2.6,
        balls: 1,
        strikes: 2,
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
      } as PitchData,
    ];

    const rows = template.transform(input, { player: 'Tarik Skubal' });
    expect(rows).toHaveLength(1);
    expect(rows[0].release_pos_x).toBe(-2.03);
    expect(rows[0].release_pos_z).toBe(5.85);
    expect(rows[0].balls).toBe(1);
    expect(rows[0].strikes).toBe(2);

    expect(template.columns({ player: 'X' })).toEqual(
      expect.arrayContaining(['release_pos_x', 'release_pos_z', 'balls', 'strikes']),
    );
  });

  it('degrades absent count/release fields to null instead of dropping rows', () => {
    const input = [
      {
        pitcher_id: '669373',
        pitcher_name: 'Tarik Skubal',
        batter_id: '1',
        batter_name: 'Batter',
        game_date: '2025-06-01',
        pitch_type: 'SL',
        release_speed: 89.9,
        release_spin_rate: 2500,
        pfx_x: -0.3,
        pfx_z: 0.2,
        plate_x: 0.2,
        plate_z: 1.9,
        launch_speed: null,
        launch_angle: null,
        hc_x: null,
        hc_y: null,
        description: 'ball',
        events: null,
        bb_type: null,
        stand: 'R',
        p_throws: 'R',
        estimated_ba: null,
        estimated_woba: null,
      } as PitchData,
    ];

    const rows = template.transform(input, { player: 'Tarik Skubal' });
    expect(rows).toHaveLength(1);
    expect(rows[0].release_pos_x).toBeNull();
    expect(rows[0].balls).toBeNull();
  });
});
