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
      'pfx_x',
      'pfx_z',
      'plate_x',
      'plate_z',
      'game_date',
    ];
  },

  transform(data) {
    const pitches = data as PitchData[];
    if (pitches.length === 0) return [];

    return pitches
      .filter((p) => p.pitch_type)
      .map((p) => ({
        pitch_type: p.pitch_type,
        release_speed: p.release_speed,
        release_spin_rate: p.release_spin_rate,
        pfx_x: p.pfx_x,
        pfx_z: p.pfx_z,
        plate_x: p.plate_x,
        plate_z: p.plate_z,
        game_date: p.game_date,
      }));
  },
};

registerTemplate(template);
