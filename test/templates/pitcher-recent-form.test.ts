import { describe, it, expect } from 'vitest';
import type { PitchData } from '../../src/adapters/types.js';

// Import all templates to trigger registration
import '../../src/templates/queries/index.js';
import { getTemplate } from '../../src/templates/queries/registry.js';

describe('pitcher-recent-form template', () => {
  const template = getTemplate('pitcher-recent-form')!;

  it('is registered', () => {
    expect(template).toBeDefined();
    expect(template.id).toBe('pitcher-recent-form');
    expect(template.category).toBe('pitcher');
  });

  it('buildQuery returns a pitching query for the given player', () => {
    const query = template.buildQuery({ player: 'Tarik Skubal', season: 2024 });
    expect(query.player_name).toBe('Tarik Skubal');
    expect(query.stat_type).toBe('pitching');
    expect(query.season).toBe(2024);
  });

  it('returns empty array for no data', () => {
    expect(template.transform([], { player: 'Skubal' })).toEqual([]);
  });

  it('groups pitches by game_date and returns at most 5 rows sorted desc', () => {
    const pitches: PitchData[] = [];
    // 6 games: 2024-04-01 .. 2024-04-06. Only the most recent 5 should return.
    for (let day = 1; day <= 6; day++) {
      const date = `2024-04-0${day}`;
      for (let p = 0; p < 3; p++) {
        pitches.push(makePitch({ game_date: date, pitch_type: 'FF', release_speed: 95 + day }));
      }
    }
    const rows = template.transform(pitches, { player: 'Skubal' });
    expect(rows).toHaveLength(5);
    // Most recent first
    expect(rows[0]!.Date).toBe('2024-04-06');
    expect(rows[4]!.Date).toBe('2024-04-02');
    // 2024-04-01 was dropped because it's the 6th-oldest
    expect(rows.find((r) => r.Date === '2024-04-01')).toBeUndefined();
  });

  it('counts hits, strikeouts, and walks from events', () => {
    const pitches: PitchData[] = [
      // Single game
      makePitch({ game_date: '2024-04-01', events: 'single' }),
      makePitch({ game_date: '2024-04-01', events: 'double' }),
      makePitch({ game_date: '2024-04-01', events: 'home_run' }),
      makePitch({ game_date: '2024-04-01', events: 'strikeout' }),
      makePitch({ game_date: '2024-04-01', events: 'walk' }),
      makePitch({ game_date: '2024-04-01', events: 'hit_by_pitch' }),
    ];
    const rows = template.transform(pitches, { player: 'Skubal' });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.H).toBe(3); // single + double + home_run
    expect(rows[0]!.K).toBe(1);
    expect(rows[0]!['BB/HBP']).toBe(2); // walk + hit_by_pitch
    expect(rows[0]!.Pitches).toBe(6);
  });

  it('uses inning + outs_when_up for IP when present', () => {
    // 2 full innings = 6 outs = "2.0" IP, constructed by tracking per-inning
    // ending out counts. Pitches that end PAs carry `outs_when_up` + events.
    const pitches: PitchData[] = [
      // Inning 1: 3 outs
      makePitch({
        game_date: '2024-04-01',
        inning: 1,
        outs_when_up: 0,
        events: 'strikeout',
      }),
      makePitch({
        game_date: '2024-04-01',
        inning: 1,
        outs_when_up: 1,
        events: 'field_out',
      }),
      makePitch({
        game_date: '2024-04-01',
        inning: 1,
        outs_when_up: 2,
        events: 'strikeout',
      }),
      // Inning 2: 3 outs
      makePitch({
        game_date: '2024-04-01',
        inning: 2,
        outs_when_up: 0,
        events: 'field_out',
      }),
      makePitch({
        game_date: '2024-04-01',
        inning: 2,
        outs_when_up: 1,
        events: 'field_out',
      }),
      makePitch({
        game_date: '2024-04-01',
        inning: 2,
        outs_when_up: 2,
        events: 'strikeout',
      }),
    ];
    const rows = template.transform(pitches, { player: 'Skubal' });
    expect(rows[0]!.IP).toBe('2.0');
  });

  it('falls back to events counting when inning/outs_when_up are null', () => {
    // 4 outs via events = IP "1.1" (one full inning + one partial out)
    const pitches: PitchData[] = [
      makePitch({ game_date: '2024-04-01', events: 'strikeout' }),
      makePitch({ game_date: '2024-04-01', events: 'field_out' }),
      makePitch({ game_date: '2024-04-01', events: 'grounded_into_double_play' }), // 2 outs
    ];
    const rows = template.transform(pitches, { player: 'Skubal' });
    expect(rows[0]!.IP).toBe('1.1');
  });

  it('computes Avg FB / Max Velo from fastball-family pitch types only', () => {
    const pitches: PitchData[] = [
      makePitch({ game_date: '2024-04-01', pitch_type: 'FF', release_speed: 96 }),
      makePitch({ game_date: '2024-04-01', pitch_type: 'SI', release_speed: 94 }),
      makePitch({ game_date: '2024-04-01', pitch_type: 'FC', release_speed: 92 }),
      // Non-FB — should be excluded from velo computation
      makePitch({ game_date: '2024-04-01', pitch_type: 'SL', release_speed: 85 }),
      makePitch({ game_date: '2024-04-01', pitch_type: 'CH', release_speed: 80 }),
    ];
    const rows = template.transform(pitches, { player: 'Skubal' });
    expect(rows[0]!['Avg FB']).toBe('94.0 mph'); // (96 + 94 + 92) / 3
    expect(rows[0]!['Max Velo']).toBe('96.0 mph');
  });

  it('returns em-dash for Avg FB / Max Velo when no fastballs present', () => {
    const pitches: PitchData[] = [
      makePitch({ game_date: '2024-04-01', pitch_type: 'SL', release_speed: 85 }),
    ];
    const rows = template.transform(pitches, { player: 'Skubal' });
    expect(rows[0]!['Avg FB']).toBe('—');
    expect(rows[0]!['Max Velo']).toBe('—');
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
    balls: null,
    strikes: null,
    outs_when_up: null,
    at_bat_number: null,
    pitch_number: null,
    ...overrides,
  };
}
