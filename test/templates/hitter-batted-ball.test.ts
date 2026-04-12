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
    // Only the home_run qualifies (110 mph, LA 28° → 110-mph range is [14,43])
    // → 1/3 = 33.3%. The single at 100/15 is outside [24,33]; field_out at 85
    // is below the 98 mph barrel floor.
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

describe('hitter-batted-ball — Savant barrel formula (BBDATA-005-followup)', () => {
  const template = getTemplate('hitter-batted-ball')!;

  // Helper: run a one-pitch dataset through transform and return barrel % as a number.
  // A single BBE gives either 0% or 100%, which makes edge-case assertions cleaner.
  function barrelRate(pitches: PitchData[]): number {
    const rows = template.transform(pitches, { player: 'Test' });
    const row = rows.find((r) => r.Metric === 'Barrel Rate');
    return row ? parseFloat((row.Value as string).replace('%', '')) : 0;
  }

  it('EV below 98 mph is never a barrel regardless of angle', () => {
    expect(
      barrelRate([makePitch({ events: 'single', launch_speed: 97.9, launch_angle: 28 })]),
    ).toBe(0);
  });

  it('at exactly 98 mph, only LA ∈ [26, 30] qualifies (inclusive bounds)', () => {
    expect(barrelRate([makePitch({ events: 'single', launch_speed: 98, launch_angle: 25 })])).toBe(0);
    expect(barrelRate([makePitch({ events: 'single', launch_speed: 98, launch_angle: 26 })])).toBe(100);
    expect(barrelRate([makePitch({ events: 'single', launch_speed: 98, launch_angle: 28 })])).toBe(100);
    expect(barrelRate([makePitch({ events: 'single', launch_speed: 98, launch_angle: 30 })])).toBe(100);
    expect(barrelRate([makePitch({ events: 'single', launch_speed: 98, launch_angle: 31 })])).toBe(0);
  });

  it('at 100 mph the range widens to [24, 33] — the old proxy would have missed these', () => {
    // Under the old formula these were NOT barrels because it capped LA at [26,30] regardless of EV.
    expect(barrelRate([makePitch({ events: 'single', launch_speed: 100, launch_angle: 24 })])).toBe(100);
    expect(barrelRate([makePitch({ events: 'single', launch_speed: 100, launch_angle: 33 })])).toBe(100);
    // Outside the widened window still disqualifies.
    expect(barrelRate([makePitch({ events: 'single', launch_speed: 100, launch_angle: 23 })])).toBe(0);
    expect(barrelRate([makePitch({ events: 'single', launch_speed: 100, launch_angle: 34 })])).toBe(0);
  });

  it('at 110 mph the range is [14, 43] — a 110-mph line drive at 15° now qualifies', () => {
    expect(barrelRate([makePitch({ events: 'single', launch_speed: 110, launch_angle: 14 })])).toBe(100);
    expect(barrelRate([makePitch({ events: 'single', launch_speed: 110, launch_angle: 15 })])).toBe(100);
    expect(barrelRate([makePitch({ events: 'single', launch_speed: 110, launch_angle: 43 })])).toBe(100);
    expect(barrelRate([makePitch({ events: 'single', launch_speed: 110, launch_angle: 13 })])).toBe(0);
    expect(barrelRate([makePitch({ events: 'single', launch_speed: 110, launch_angle: 44 })])).toBe(0);
  });

  it('at 116 mph the range caps at [8, 50] and stays there for higher EVs', () => {
    expect(barrelRate([makePitch({ events: 'single', launch_speed: 116, launch_angle: 8 })])).toBe(100);
    expect(barrelRate([makePitch({ events: 'single', launch_speed: 116, launch_angle: 50 })])).toBe(100);
    expect(barrelRate([makePitch({ events: 'single', launch_speed: 116, launch_angle: 7 })])).toBe(0);
    expect(barrelRate([makePitch({ events: 'single', launch_speed: 116, launch_angle: 51 })])).toBe(0);
    // A 120 mph rocket at the cap edges should also qualify.
    expect(barrelRate([makePitch({ events: 'single', launch_speed: 120, launch_angle: 8 })])).toBe(100);
    expect(barrelRate([makePitch({ events: 'single', launch_speed: 120, launch_angle: 50 })])).toBe(100);
    expect(barrelRate([makePitch({ events: 'single', launch_speed: 120, launch_angle: 51 })])).toBe(0);
  });

  it('fractional EV uses the floor bucket (99.7 → 99-mph range [25, 31])', () => {
    expect(barrelRate([makePitch({ events: 'single', launch_speed: 99.7, launch_angle: 25 })])).toBe(100);
    expect(barrelRate([makePitch({ events: 'single', launch_speed: 99.7, launch_angle: 31 })])).toBe(100);
    // LA 24 is outside the 99-mph range [25,31] even though it would qualify at 100.
    expect(barrelRate([makePitch({ events: 'single', launch_speed: 99.7, launch_angle: 24 })])).toBe(0);
  });

  it('null launch_speed or launch_angle never qualifies as a barrel', () => {
    expect(
      barrelRate([
        makePitch({ events: 'single', launch_speed: null, launch_angle: 28 }),
        makePitch({ events: 'single', launch_speed: 100, launch_angle: null }),
      ]),
    ).toBe(0);
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
