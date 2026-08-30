import { describe, it, expect } from 'vitest';
import type { PitchData } from '../../src/adapters/types.js';

import '../../src/templates/queries/index.js';
import { getTemplate } from '../../src/templates/queries/registry.js';

const template = getTemplate('hitter-raw-bip')!;

function pitch(overrides: Partial<PitchData> = {}): PitchData {
  return {
    pitcher_id: '1',
    pitcher_name: 'Pitcher',
    batter_id: '592450',
    batter_name: 'Aaron Judge',
    game_date: '2025-05-01',
    pitch_type: 'FF',
    release_speed: 95,
    release_spin_rate: 2300,
    pfx_x: 0.5,
    pfx_z: 1.2,
    plate_x: 0,
    plate_z: 2.5,
    launch_speed: 98.4,
    launch_angle: 24,
    hc_x: 130.2,
    hc_y: 60.5,
    description: 'hit_into_play',
    events: 'home_run',
    bb_type: 'fly_ball',
    stand: 'R',
    p_throws: 'R',
    estimated_ba: null,
    estimated_woba: null,
    ...overrides,
  };
}

describe('hitter-raw-bip template', () => {
  it('retains tracking-dropout batted balls with null coordinates (P3.6 regression)', () => {
    // A real home run with missing hc_x/hc_y used to vanish from the
    // pull entirely, so counts aggregated from this template were
    // quietly short (52 vs the season profile's 53 for Judge 2025).
    const input = [
      pitch({ events: 'single', hc_x: 140, hc_y: 100 }),
      pitch({ events: 'home_run', hc_x: null, hc_y: null, launch_speed: null, launch_angle: null }),
    ];
    const rows = template.transform(input, { player: 'Aaron Judge' });
    expect(rows).toHaveLength(2);
    const hr = rows.find((r) => r.events === 'home_run')!;
    expect(hr.hc_x).toBeNull();
    expect(hr.launch_speed).toBeNull();
  });

  it('filters to batted balls by description, not by tracking presence', () => {
    const input = [
      pitch({ description: 'hit_into_play', events: 'field_out' }),
      pitch({ description: 'swinging_strike', events: null, launch_speed: null }),
      pitch({ description: 'ball', events: null, launch_speed: null }),
    ];
    const rows = template.transform(input, { player: 'Aaron Judge' });
    expect(rows).toHaveLength(1);
    expect(rows[0].events).toBe('field_out');
  });
});
