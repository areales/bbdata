import { describe, it, expect } from 'vitest';
import type { PitchData } from '../../src/adapters/types.js';

import '../../src/templates/queries/index.js';
import { getTemplate } from '../../src/templates/queries/registry.js';

const template = getTemplate('matchup-pitcher-vs-hitter')!;

function pitch(overrides: Partial<PitchData> = {}): PitchData {
  return {
    pitcher_id: '592332',
    pitcher_name: 'Kevin Gausman',
    batter_id: '592450',
    batter_name: 'Unknown (#592450)',
    game_date: '2024-05-01',
    pitch_type: 'FS',
    release_speed: 94.1,
    release_spin_rate: 2200,
    pfx_x: -0.4,
    pfx_z: 0.7,
    plate_x: 0.1,
    plate_z: 2.4,
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

describe('matchup-pitcher-vs-hitter template', () => {
  it('buildQuery carries the hitter as opponent_name for server-side filtering (P1.8)', () => {
    const q = template.buildQuery({ players: ['Kevin Gausman', 'Aaron Judge'], season: 2024 });
    expect(q.player_name).toBe('Kevin Gausman');
    expect(q.opponent_name).toBe('Aaron Judge');
    expect(q.stat_type).toBe('pitching');
  });

  it('uses a server-filtered single-batter payload even when batter names are unknown (P1.8)', () => {
    // Live Savant CSVs carry no batter-name column — every row renders as
    // "Unknown (#id)". The old name filter matched nothing and reported
    // "No matchup data found" for genuine matchups.
    const pitches = [
      pitch({ description: 'called_strike' }),
      pitch({ description: 'swinging_strike', events: 'strikeout' }),
      pitch({ description: 'hit_into_play', events: 'home_run' }),
    ];
    const rows = template.transform(pitches, { players: ['Kevin Gausman', 'Aaron Judge'] });
    const byMetric = new Map(rows.map((r) => [r.Metric, r.Value]));
    expect(byMetric.get('Total Pitches')).toBe(3);
    expect(byMetric.get('Home Runs')).toBe(1);
    expect(byMetric.get('Strikeouts')).toBe(1);
  });

  it('still name-filters payloads that carry batter names (stdin path)', () => {
    const pitches = [
      pitch({ batter_id: '592450', batter_name: 'Aaron Judge', events: 'single' }),
      pitch({ batter_id: '660271', batter_name: 'Shohei Ohtani', events: 'strikeout' }),
    ];
    const rows = template.transform(pitches, { players: ['Kevin Gausman', 'Aaron Judge'] });
    const byMetric = new Map(rows.map((r) => [r.Metric, r.Value]));
    expect(byMetric.get('Total Pitches')).toBe(1);
    expect(byMetric.get('Hits')).toBe(1);
  });

  it('computes AVG and SLG per at-bat, not per plate appearance', () => {
    // 4 PA: single, walk, strikeout, home run → 3 AB, 2 hits, 5 TB.
    const pitches = [
      pitch({ events: 'single' }),
      pitch({ events: 'walk' }),
      pitch({ events: 'strikeout' }),
      pitch({ events: 'home_run' }),
    ];
    const rows = template.transform(pitches, { players: ['Kevin Gausman', 'Aaron Judge'] });
    const byMetric = new Map(rows.map((r) => [r.Metric, r.Value]));
    expect(byMetric.get('Plate Appearances')).toBe(4);
    expect(byMetric.get('AVG')).toBe('0.667');
    expect(byMetric.get('SLG')).toBe('1.667');
    expect(byMetric.get('Walks')).toBe(1);
  });

  it('reports a note row when a multi-batter payload has no matching hitter', () => {
    const pitches = [
      pitch({ batter_id: '1', batter_name: 'Unknown (#1)' }),
      pitch({ batter_id: '2', batter_name: 'Unknown (#2)' }),
    ];
    const rows = template.transform(pitches, { players: ['Kevin Gausman', 'Aaron Judge'] });
    expect(rows).toHaveLength(1);
    expect(rows[0].Metric).toBe('Note');
    expect(String(rows[0].Value)).toContain('No matchup data');
  });
});
