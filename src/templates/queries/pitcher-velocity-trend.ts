import { registerTemplate, type QueryTemplate } from './registry.js';
import { assertFields } from '../../utils/validate-records.js';
import type { PitchData } from '../../adapters/types.js';


const REQUIRED_FIELDS = ['pitch_type', 'release_speed'];

const template: QueryTemplate = {
  id: 'pitcher-velocity-trend',
  name: 'Pitcher Velocity Trend',
  category: 'pitcher',
  description: 'Month-by-month fastball velocity tracking — flags drops > 0.5 mph',
  preferredSources: ['savant'],
  requiredParams: ['player'],
  optionalParams: ['season'],
  examples: [
    'bbdata query pitcher-velocity-trend --player "Gerrit Cole" --season 2025',
  ],

  buildQuery(params) {
    return {
      player_name: params.player,
      season: params.season ?? new Date().getFullYear(),
      stat_type: 'pitching',
    };
  },

  columns() {
    return ['Month', 'Avg Velo', 'Max Velo', 'Min Velo', 'Δ vs Prior', 'Pitches', 'Flag'];
  },

  transform(data) {
    const pitches = (data as PitchData[]).filter(
      (p) => ['FF', 'SI', 'FC'].includes(p.pitch_type) && p.release_speed > 0,
    );

    if (pitches.length === 0) return [];
    assertFields(pitches, REQUIRED_FIELDS, 'pitcher-velocity-trend');


    // Group by month
    const byMonth = new Map<string, PitchData[]>();
    for (const pitch of pitches) {
      const month = pitch.game_date.slice(0, 7); // YYYY-MM
      const group = byMonth.get(month) ?? [];
      group.push(pitch);
      byMonth.set(month, group);
    }

    const months = Array.from(byMonth.entries()).sort(([a], [b]) => a.localeCompare(b));
    let prevAvg: number | null = null;

    return months.map(([month, group]) => {
      const velos = group.map((p) => p.release_speed);
      const avg = velos.reduce((s, v) => s + v, 0) / velos.length;
      const max = Math.max(...velos);
      const min = Math.min(...velos);

      const delta = prevAvg !== null ? avg - prevAvg : 0;
      const flag = prevAvg !== null && delta < -0.5 ? '⚠ DROP' : '';
      prevAvg = avg;

      return {
        Month: month,
        'Avg Velo': avg.toFixed(1) + ' mph',
        'Max Velo': max.toFixed(1) + ' mph',
        'Min Velo': min.toFixed(1) + ' mph',
        'Δ vs Prior': prevAvg !== null && delta !== 0
          ? (delta > 0 ? '+' : '') + delta.toFixed(1) + ' mph'
          : '—',
        Pitches: group.length,
        Flag: flag,
      };
    });
  },
};

registerTemplate(template);
