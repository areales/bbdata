import { describe, it, expect } from 'vitest';
import type { PitchData } from '../../src/adapters/types.js';

// Import all templates to trigger registration
import '../../src/templates/queries/index.js';
import { getTemplate } from '../../src/templates/queries/registry.js';

describe('pitcher-arsenal template', () => {
  const template = getTemplate('pitcher-arsenal')!;

  it('is registered', () => {
    expect(template).toBeDefined();
    expect(template.id).toBe('pitcher-arsenal');
    expect(template.category).toBe('pitcher');
  });

  it('requires player param', () => {
    expect(template.requiredParams).toContain('player');
  });

  it('buildQuery creates a pitching query', () => {
    const query = template.buildQuery({ player: 'Corbin Burnes', season: 2025 });
    expect(query.player_name).toBe('Corbin Burnes');
    expect(query.stat_type).toBe('pitching');
    expect(query.season).toBe(2025);
  });

  it('transform groups pitches by type and calculates stats', () => {
    const pitches: PitchData[] = [
      makePitch({ pitch_type: 'FF', release_speed: 95, release_spin_rate: 2300, description: 'called_strike' }),
      makePitch({ pitch_type: 'FF', release_speed: 96, release_spin_rate: 2400, description: 'swinging_strike' }),
      makePitch({ pitch_type: 'FF', release_speed: 94, release_spin_rate: 2350, description: 'foul' }),
      makePitch({ pitch_type: 'SL', release_speed: 87, release_spin_rate: 2700, description: 'swinging_strike' }),
      makePitch({ pitch_type: 'SL', release_speed: 86, release_spin_rate: 2650, description: 'ball' }),
    ];

    const rows = template.transform(pitches, { player: 'Burnes' });

    expect(rows.length).toBe(2);

    // FF should be first (3 pitches > 2 pitches for SL)
    const ff = rows.find((r) => (r['Pitch Type'] as string).includes('Fastball'));
    expect(ff).toBeDefined();
    expect(ff!['Usage %']).toBe('60.0%');
    expect(ff!['Pitches']).toBe(3);
    // Avg velo should be ~95.0
    expect(ff!['Avg Velo']).toContain('95.0');

    const sl = rows.find((r) => (r['Pitch Type'] as string).includes('Slider'));
    expect(sl).toBeDefined();
    expect(sl!['Usage %']).toBe('40.0%');
    expect(sl!['Pitches']).toBe(2);
  });

  it('returns empty array for no data', () => {
    const rows = template.transform([], { player: 'Burnes' });
    expect(rows).toEqual([]);
  });

  it('calculates whiff % correctly', () => {
    const pitches: PitchData[] = [
      // 2 swings (1 swinging_strike + 1 foul), 1 whiff → 50% whiff rate
      makePitch({ pitch_type: 'SL', description: 'swinging_strike' }),
      makePitch({ pitch_type: 'SL', description: 'foul' }),
      makePitch({ pitch_type: 'SL', description: 'called_strike' }),
    ];

    const rows = template.transform(pitches, { player: 'Burnes' });
    expect(rows[0]['Whiff %']).toBe('50.0%');
  });
});

function makePitch(overrides: Partial<PitchData> = {}): PitchData {
  return {
    pitcher_id: '669203',
    pitcher_name: 'Corbin Burnes',
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
