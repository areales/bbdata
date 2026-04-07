import { registerTemplate, type QueryTemplate } from './registry.js';
import type { PitchData } from '../../adapters/types.js';
import { pitchTypeName } from '../../adapters/types.js';

const template: QueryTemplate = {
  id: 'hitter-vs-pitch-type',
  name: 'Hitter vs Pitch Type',
  category: 'hitter',
  description: 'Swing rate, whiff rate, exit velocity, and outcomes by pitch type faced',
  preferredSources: ['savant'],
  requiredParams: ['player'],
  optionalParams: ['season'],
  examples: [
    'bbdata query hitter-vs-pitch-type --player "Mookie Betts" --season 2025',
  ],

  buildQuery(params) {
    return {
      player_name: params.player,
      season: params.season ?? new Date().getFullYear(),
      stat_type: 'batting',
    };
  },

  columns() {
    return ['Pitch Type', 'Seen', 'Swing %', 'Whiff %', 'Foul %', 'In Play', 'Avg EV', 'SLG'];
  },

  transform(data) {
    const pitches = data as PitchData[];
    if (pitches.length === 0) return [];

    const byType = new Map<string, PitchData[]>();
    for (const p of pitches) {
      if (!p.pitch_type) continue;
      const group = byType.get(p.pitch_type) ?? [];
      group.push(p);
      byType.set(p.pitch_type, group);
    }

    return Array.from(byType.entries())
      .map(([type, group]) => {
        const swings = group.filter((p) =>
          p.description.includes('swing') || p.description.includes('foul') || p.description.includes('hit_into_play'),
        );
        const whiffs = group.filter((p) => p.description.includes('swinging_strike'));
        const fouls = group.filter((p) => p.description.includes('foul'));
        const inPlay = group.filter((p) => p.description.includes('hit_into_play'));
        const contacted = group.filter((p) => p.launch_speed !== null && p.launch_speed > 0);

        // SLG on contact
        const totalBases = group.reduce((sum, p) => {
          if (p.events === 'single') return sum + 1;
          if (p.events === 'double') return sum + 2;
          if (p.events === 'triple') return sum + 3;
          if (p.events === 'home_run') return sum + 4;
          return sum;
        }, 0);
        const abs = group.filter((p) => p.events && !['walk', 'hit_by_pitch', 'sac_fly', 'sac_bunt'].includes(p.events)).length;

        return {
          'Pitch Type': pitchTypeName(type),
          Seen: group.length,
          'Swing %': ((swings.length / group.length) * 100).toFixed(1) + '%',
          'Whiff %': swings.length > 0 ? ((whiffs.length / swings.length) * 100).toFixed(1) + '%' : '—',
          'Foul %': swings.length > 0 ? ((fouls.length / swings.length) * 100).toFixed(1) + '%' : '—',
          'In Play': inPlay.length,
          'Avg EV': contacted.length > 0
            ? (contacted.reduce((s, p) => s + p.launch_speed!, 0) / contacted.length).toFixed(1) + ' mph'
            : '—',
          SLG: abs > 0 ? (totalBases / abs).toFixed(3) : '—',
        };
      })
      .sort((a, b) => (b.Seen as number) - (a.Seen as number));
  },
};

registerTemplate(template);
