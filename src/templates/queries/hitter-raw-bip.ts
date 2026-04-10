import { registerTemplate, type QueryTemplate } from './registry.js';
import type { PitchData } from '../../adapters/types.js';

/**
 * Raw batted-ball projection — one row per ball in play with hit coordinates.
 * Powers the spray chart. Filters to pitches where launch_speed is recorded
 * (i.e., the ball was actually put in play).
 */
const template: QueryTemplate = {
  id: 'hitter-raw-bip',
  name: 'Hitter Raw Batted Balls',
  category: 'hitter',
  description: 'One row per batted ball with hit coordinates, exit velo, and launch angle',
  preferredSources: ['savant'],
  requiredParams: ['player'],
  optionalParams: ['season'],
  examples: [
    'bbdata query hitter-raw-bip --player "Aaron Judge" --season 2025 --format json',
  ],

  buildQuery(params) {
    return {
      player_name: params.player,
      season: params.season ?? new Date().getFullYear(),
      stat_type: 'batting',
    };
  },

  columns() {
    return [
      'hc_x',
      'hc_y',
      'launch_speed',
      'launch_angle',
      'events',
      'bb_type',
      'game_date',
    ];
  },

  transform(data) {
    const pitches = data as PitchData[];
    if (pitches.length === 0) return [];

    return pitches
      .filter(
        (p) =>
          p.launch_speed != null &&
          p.launch_speed > 0 &&
          p.hc_x != null &&
          p.hc_y != null,
      )
      .map((p) => ({
        hc_x: p.hc_x,
        hc_y: p.hc_y,
        launch_speed: p.launch_speed,
        launch_angle: p.launch_angle,
        events: p.events ?? 'unknown',
        bb_type: p.bb_type ?? 'unknown',
        game_date: p.game_date,
      }));
  },
};

registerTemplate(template);
