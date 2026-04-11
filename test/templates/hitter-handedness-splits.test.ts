import { describe, it, expect } from 'vitest';
import type { PitchData } from '../../src/adapters/types.js';

// Import all templates to trigger registration
import '../../src/templates/queries/index.js';
import { getTemplate } from '../../src/templates/queries/registry.js';

describe('hitter-handedness-splits template', () => {
  const template = getTemplate('hitter-handedness-splits')!;

  it('is registered', () => {
    expect(template).toBeDefined();
    expect(template.id).toBe('hitter-handedness-splits');
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

  it('transform returns exactly two rows keyed by pitcher handedness', () => {
    const pitches: PitchData[] = [
      // vs LHP: 1 whiff, 1 single at 100 mph
      makePitch({ p_throws: 'L', description: 'swinging_strike', events: 'strikeout' }),
      makePitch({ p_throws: 'L', description: 'hit_into_play', events: 'single', launch_speed: 100 }),
      // vs RHP: 1 home run at 110 mph, 1 walk
      makePitch({ p_throws: 'R', description: 'hit_into_play', events: 'home_run', launch_speed: 110 }),
      makePitch({ p_throws: 'R', description: 'ball', events: 'walk' }),
    ];

    const rows = template.transform(pitches, { player: 'Judge' });
    expect(rows.length).toBe(2);

    const vsL = rows.find((r) => r.vs === 'vs LHP')!;
    expect(vsL).toBeDefined();
    expect(vsL.PA).toBe(2);
    expect(vsL.AVG).toBe('0.500');
    expect(vsL.SLG).toBe('0.500');
    expect(vsL['K %']).toBe('50.0%');
    expect(vsL['BB %']).toBe('0.0%');
    expect(vsL['Avg EV']).toBe('100.0 mph');
    expect(vsL['Whiff %']).toBe('100.0%');

    const vsR = rows.find((r) => r.vs === 'vs RHP')!;
    expect(vsR).toBeDefined();
    expect(vsR.PA).toBe(2);
    expect(vsR.AVG).toBe('0.500');
    expect(vsR.SLG).toBe('2.000');
    expect(vsR['K %']).toBe('0.0%');
    expect(vsR['BB %']).toBe('50.0%');
    expect(vsR['Avg EV']).toBe('110.0 mph');
  });

  it('returns empty array for no data', () => {
    const rows = template.transform([], { player: 'Judge' });
    expect(rows).toEqual([]);
  });

  it('returns a zero row for the missing handedness side', () => {
    // Only vs RHP pitches — vs LHP should render as an empty zero row
    const pitches: PitchData[] = [
      makePitch({ p_throws: 'R', description: 'hit_into_play', events: 'single', launch_speed: 98 }),
    ];

    const rows = template.transform(pitches, { player: 'Judge' });
    expect(rows.length).toBe(2);

    const vsL = rows.find((r) => r.vs === 'vs LHP')!;
    expect(vsL).toBeDefined();
    expect(vsL.PA).toBe(0);
    expect(vsL.AVG).toBe('—');
    expect(vsL.SLG).toBe('—');

    const vsR = rows.find((r) => r.vs === 'vs RHP')!;
    expect(vsR).toBeDefined();
    expect(vsR.PA).toBe(1);
  });

  it('filters by pitcher handedness (p_throws), not batter stance (stand)', () => {
    // Mixed batter stance but all against LHP — should all aggregate under vs LHP
    const pitches: PitchData[] = [
      makePitch({ p_throws: 'L', stand: 'L', description: 'hit_into_play', events: 'single', launch_speed: 95 }),
      makePitch({ p_throws: 'L', stand: 'R', description: 'hit_into_play', events: 'double', launch_speed: 105 }),
    ];

    const rows = template.transform(pitches, { player: 'Judge' });
    const vsL = rows.find((r) => r.vs === 'vs LHP')!;
    expect(vsL.PA).toBe(2);
    // 1 single (1) + 1 double (2) = 3 total bases / 2 PA
    expect(vsL.SLG).toBe('1.500');

    const vsR = rows.find((r) => r.vs === 'vs RHP')!;
    expect(vsR.PA).toBe(0);
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
