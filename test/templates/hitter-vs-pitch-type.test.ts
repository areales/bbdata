import { describe, it, expect } from 'vitest';
import type { PitchData } from '../../src/adapters/types.js';

import '../../src/templates/queries/index.js';
import { getTemplate } from '../../src/templates/queries/registry.js';

const template = getTemplate('hitter-vs-pitch-type')!;

function pitch(overrides: Partial<PitchData> = {}): PitchData {
  return {
    pitcher_id: '1',
    pitcher_name: 'Pitcher',
    batter_id: '660271',
    batter_name: 'Shohei Ohtani',
    game_date: '2025-05-01',
    pitch_type: 'FF',
    release_speed: 95,
    release_spin_rate: 2300,
    pfx_x: 0.5,
    pfx_z: 1.2,
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
    ...overrides,
  };
}

function nPitches(type: string, n: number): PitchData[] {
  return Array.from({ length: n }, () => pitch({ pitch_type: type }));
}

describe('hitter-vs-pitch-type template', () => {
  it('drops pitch types below the 20-pitch default minimum (P3.5 regression)', () => {
    // The course prompt this template mirrors says "only include pitch
    // types with at least 20 pitches faced" — a 3-pitch junk tail used
    // to render 100%-style rates with no sample behind them.
    const input = [...nPitches('FF', 25), ...nPitches('SV', 3)];
    const rows = template.transform(input, { player: 'Shohei Ohtani' });
    expect(rows).toHaveLength(1);
    expect(rows[0]['Pitch Type']).toBe('Four-Seam Fastball');
  });

  it('honors --min-pitches overrides in both directions', () => {
    const input = [...nPitches('FF', 25), ...nPitches('SV', 3)];

    const all = template.transform(input, { player: 'Shohei Ohtani', minPitches: 1 });
    expect(all).toHaveLength(2);

    const strict = template.transform(input, { player: 'Shohei Ohtani', minPitches: 30 });
    expect(strict).toHaveLength(0);
  });
});
