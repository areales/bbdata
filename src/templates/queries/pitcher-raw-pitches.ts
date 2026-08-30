import { registerTemplate, type QueryTemplate } from './registry.js';
import type { PitchData } from '../../adapters/types.js';

/**
 * Raw pitch-level projection — one row per pitch, coordinate columns preserved.
 * Powers the pitch-movement visualization (pfx_x, pfx_z scatter).
 * Unlike pitcher-arsenal this does NOT aggregate; viz builders need per-pitch points.
 */
const template: QueryTemplate = {
  id: 'pitcher-raw-pitches',
  name: 'Pitcher Raw Pitches',
  category: 'pitcher',
  description: 'One row per pitch with coordinate columns for visualization (movement, location)',
  preferredSources: ['savant'],
  requiredParams: ['player'],
  optionalParams: ['season', 'pitchType'],
  examples: [
    'bbdata query pitcher-raw-pitches --player "Corbin Burnes" --season 2025 --format json',
  ],

  buildQuery(params) {
    return {
      player_name: params.player,
      season: params.season ?? new Date().getFullYear(),
      stat_type: 'pitching',
      pitch_type: params.pitchType ? [params.pitchType] : undefined,
    };
  },

  columns() {
    return [
      'pitch_type',
      'release_speed',
      'release_spin_rate',
      'release_pos_x',
      'release_pos_z',
      'pfx_x',
      'pfx_z',
      'plate_x',
      'plate_z',
      'balls',
      'strikes',
      'game_date',
    ];
  },

  columnFormats() {
    // Movement/location values (feet) straddle 1.0, so without a fixed
    // precision the same column would mix "0.950" and "1.1" rows.
    return {
      release_pos_x: { decimals: 2 },
      release_pos_z: { decimals: 2 },
      pfx_x: { decimals: 2 },
      pfx_z: { decimals: 2 },
      plate_x: { decimals: 2 },
      plate_z: { decimals: 2 },
    };
  },

  transform(data) {
    const pitches = data as PitchData[];
    if (pitches.length === 0) return [];

    // Count state and release point (P4.11): pass-throughs that let the
    // course's Pitch Mix by Count and Release Point Plot templates build
    // from bbdata output instead of requiring a raw Savant export.
    return pitches
      .filter((p) => p.pitch_type)
      .map((p) => ({
        pitch_type: p.pitch_type,
        release_speed: p.release_speed,
        release_spin_rate: p.release_spin_rate,
        release_pos_x: p.release_pos_x ?? null,
        release_pos_z: p.release_pos_z ?? null,
        pfx_x: p.pfx_x,
        pfx_z: p.pfx_z,
        plate_x: p.plate_x,
        plate_z: p.plate_z,
        balls: p.balls ?? null,
        strikes: p.strikes ?? null,
        game_date: p.game_date,
      }));
  },
};

registerTemplate(template);
