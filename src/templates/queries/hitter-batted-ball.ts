import { registerTemplate, type QueryTemplate } from './registry.js';
import type { PitchData } from '../../adapters/types.js';

const template: QueryTemplate = {
  id: 'hitter-batted-ball',
  name: 'Hitter Batted Ball Profile',
  category: 'hitter',
  description: 'Exit velocity, launch angle, hard hit rate, barrel rate, batted ball distribution',
  preferredSources: ['savant', 'fangraphs'],
  requiredParams: ['player'],
  optionalParams: ['season'],
  examples: [
    'bbdata query hitter-batted-ball --player "Aaron Judge" --season 2025',
    'bbdata query hitter-batted-ball --player "Juan Soto"',
  ],

  buildQuery(params) {
    return {
      player_name: params.player,
      season: params.season ?? new Date().getFullYear(),
      stat_type: 'batting',
    };
  },

  columns() {
    return ['Metric', 'Value'];
  },

  transform(data) {
    const pitches = data as PitchData[];
    const batted = pitches.filter((p) => p.launch_speed !== null && p.launch_speed > 0);

    if (batted.length === 0) return [];

    const evs = batted.map((p) => p.launch_speed!);
    const las = batted.map((p) => p.launch_angle!);
    const avgEv = evs.reduce((s, v) => s + v, 0) / evs.length;
    const avgLa = las.reduce((s, v) => s + v, 0) / las.length;

    const hardHit = batted.filter((p) => p.launch_speed! >= 95).length;
    // Barrel = EV >= 98 mph and LA between 26-30 (simplified)
    const barrels = batted.filter(
      (p) => p.launch_speed! >= 98 && p.launch_angle! >= 26 && p.launch_angle! <= 30,
    ).length;

    const linedrives = batted.filter((p) => p.bb_type === 'line_drive').length;
    const flyballs = batted.filter((p) => p.bb_type === 'fly_ball').length;
    const groundballs = batted.filter((p) => p.bb_type === 'ground_ball').length;
    const popups = batted.filter((p) => p.bb_type === 'popup').length;

    return [
      { Metric: 'Batted Balls', Value: batted.length },
      { Metric: 'Avg Exit Velocity', Value: avgEv.toFixed(1) + ' mph' },
      { Metric: 'Max Exit Velocity', Value: Math.max(...evs).toFixed(1) + ' mph' },
      { Metric: 'Avg Launch Angle', Value: avgLa.toFixed(1) + '°' },
      { Metric: 'Hard Hit Rate (95+ mph)', Value: ((hardHit / batted.length) * 100).toFixed(1) + '%' },
      { Metric: 'Barrel Rate', Value: ((barrels / batted.length) * 100).toFixed(1) + '%' },
      { Metric: 'Line Drive %', Value: ((linedrives / batted.length) * 100).toFixed(1) + '%' },
      { Metric: 'Fly Ball %', Value: ((flyballs / batted.length) * 100).toFixed(1) + '%' },
      { Metric: 'Ground Ball %', Value: ((groundballs / batted.length) * 100).toFixed(1) + '%' },
      { Metric: 'Popup %', Value: ((popups / batted.length) * 100).toFixed(1) + '%' },
    ];
  },
};

registerTemplate(template);
