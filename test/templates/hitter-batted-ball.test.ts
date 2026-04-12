import { describe, it, expect } from 'vitest';
import type { PitchData } from '../../src/adapters/types.js';

// Import all templates to trigger registration
import '../../src/templates/queries/index.js';
import { getTemplate } from '../../src/templates/queries/registry.js';

describe('hitter-batted-ball template', () => {
  const template = getTemplate('hitter-batted-ball')!;

  it('is registered', () => {
    expect(template).toBeDefined();
    expect(template.id).toBe('hitter-batted-ball');
    expect(template.category).toBe('hitter');
  });

  it('requires player param', () => {
    expect(template.requiredParams).toContain('player');
  });

  it('buildQuery creates a batting query', () => {
    const query = template.buildQuery({ player: 'Aaron Judge', season: 2025 });
    expect(query.player_name).toBe('Aaron Judge');
    expect(query.stat_type).toBe('batting');
    expect(query.season).toBe(2025);
  });

  it('excludes foul balls from the batted-ball denominator (BBDATA-005)', () => {
    // 3 batted-ball events (single 100, home_run 110, field_out 85) plus
    // 2 foul balls with tracked launch speed (60, 70) and 1 called strike.
    // Without the fix, foul balls get averaged in and drag Avg EV down.
    // With the fix, the rollup only sees the 3 BBEs → Avg EV = (100+110+85)/3 ≈ 98.3.
    const pitches: PitchData[] = [
      makePitch({ description: 'hit_into_play', events: 'single', launch_speed: 100, launch_angle: 15, bb_type: 'line_drive' }),
      makePitch({ description: 'hit_into_play', events: 'home_run', launch_speed: 110, launch_angle: 28, bb_type: 'fly_ball' }),
      makePitch({ description: 'hit_into_play', events: 'field_out', launch_speed: 85, launch_angle: 45, bb_type: 'fly_ball' }),
      makePitch({ description: 'foul', events: null, launch_speed: 60, launch_angle: 5 }),
      makePitch({ description: 'foul', events: null, launch_speed: 70, launch_angle: 10 }),
      makePitch({ description: 'called_strike', events: null }),
    ];

    const rows = template.transform(pitches, { player: 'Judge' });

    const battedBalls = rows.find((r) => r.Metric === 'Batted Balls');
    expect(battedBalls?.Value).toBe(3);

    const avgEv = rows.find((r) => r.Metric === 'Avg Exit Velocity');
    // (100 + 110 + 85) / 3 = 98.3
    expect(avgEv?.Value).toBe('98.3 mph');

    const maxEv = rows.find((r) => r.Metric === 'Max Exit Velocity');
    expect(maxEv?.Value).toBe('110.0 mph');

    const hardHit = rows.find((r) => r.Metric === 'Hard Hit Rate (95+ mph)');
    // single (100) and home_run (110) are ≥95 → 2/3 = 66.7%
    expect(hardHit?.Value).toBe('66.7%');

    const barrel = rows.find((r) => r.Metric === 'Barrel Rate');
    // Only the home_run qualifies (110 ≥ 98, LA 28 ∈ [26,30]) → 1/3 = 33.3%
    expect(barrel?.Value).toBe('33.3%');
  });

  it('batted-ball type distribution sums to 100% across BBEs (BBDATA-006)', () => {
    // 10 BBEs split cleanly: 2 LD, 4 FB, 3 GB, 1 PU.
    // Expected %s: 20 / 40 / 30 / 10 → sum 100.
    const pitches: PitchData[] = [
      ...Array(2).fill(null).map(() => makePitch({ events: 'single', launch_speed: 95, launch_angle: 15, bb_type: 'line_drive' })),
      ...Array(4).fill(null).map(() => makePitch({ events: 'home_run', launch_speed: 105, launch_angle: 28, bb_type: 'fly_ball' })),
      ...Array(3).fill(null).map(() => makePitch({ events: 'field_out', launch_speed: 85, launch_angle: -5, bb_type: 'ground_ball' })),
      ...Array(1).fill(null).map(() => makePitch({ events: 'field_out', launch_speed: 75, launch_angle: 65, bb_type: 'popup' })),
      // 5 foul balls to prove they don't dilute the distribution
      ...Array(5).fill(null).map(() => makePitch({ description: 'foul', events: null, launch_speed: 60 })),
    ];

    const rows = template.transform(pitches, { player: 'Judge' });

    const ld = rows.find((r) => r.Metric === 'Line Drive %')!;
    const fb = rows.find((r) => r.Metric === 'Fly Ball %')!;
    const gb = rows.find((r) => r.Metric === 'Ground Ball %')!;
    const pu = rows.find((r) => r.Metric === 'Popup %')!;

    expect(ld.Value).toBe('20.0%');
    expect(fb.Value).toBe('40.0%');
    expect(gb.Value).toBe('30.0%');
    expect(pu.Value).toBe('10.0%');

    // Sum the parsed percentages to confirm they add to ~100
    const sum = [ld, fb, gb, pu].reduce(
      (acc, row) => acc + parseFloat((row.Value as string).replace('%', '')),
      0,
    );
    expect(sum).toBeCloseTo(100, 1);
  });

  it('excludes walks, strikeouts, and hit-by-pitches from batted balls', () => {
    // Only the home_run is a BBE.
    const pitches: PitchData[] = [
      makePitch({ description: 'ball', events: 'walk' }),
      makePitch({ description: 'swinging_strike', events: 'strikeout' }),
      makePitch({ description: 'hit_by_pitch', events: 'hit_by_pitch' }),
      makePitch({ description: 'hit_into_play', events: 'home_run', launch_speed: 108, launch_angle: 28, bb_type: 'fly_ball' }),
    ];

    const rows = template.transform(pitches, { player: 'Judge' });
    const battedBalls = rows.find((r) => r.Metric === 'Batted Balls');
    expect(battedBalls?.Value).toBe(1);
  });

  it('returns empty array for no data', () => {
    const rows = template.transform([], { player: 'Judge' });
    expect(rows).toEqual([]);
  });

  it('returns empty array when no batted-ball events are present', () => {
    const pitches: PitchData[] = [
      makePitch({ description: 'foul', events: null, launch_speed: 60 }),
      makePitch({ description: 'called_strike', events: null }),
    ];

    const rows = template.transform(pitches, { player: 'Judge' });
    expect(rows).toEqual([]);
  });
});

function makePitch(overrides: Partial<PitchData> = {}): PitchData {
  return {
    pitcher_id: '669203',
    pitcher_name: 'Some Pitcher',
    batter_id: '592450',
    batter_name: 'Aaron Judge',
    game_date: '2025-04-15',
    pitch_type: 'FF',
    release_speed: 95,
    release_spin_rate: 2350,
    pfx_x: 0.8,
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
