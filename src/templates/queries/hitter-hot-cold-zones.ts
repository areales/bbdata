import { registerTemplate, type QueryTemplate } from './registry.js';
import type { PitchData } from '../../adapters/types.js';

// 3x3 strike zone grid
const ZONES = {
  'High-In':    { xMin: -0.83, xMax: -0.28, zMin: 2.83, zMax: 3.5 },
  'High-Mid':   { xMin: -0.28, xMax: 0.28,  zMin: 2.83, zMax: 3.5 },
  'High-Out':   { xMin: 0.28,  xMax: 0.83,  zMin: 2.83, zMax: 3.5 },
  'Mid-In':     { xMin: -0.83, xMax: -0.28, zMin: 2.17, zMax: 2.83 },
  'Mid-Mid':    { xMin: -0.28, xMax: 0.28,  zMin: 2.17, zMax: 2.83 },
  'Mid-Out':    { xMin: 0.28,  xMax: 0.83,  zMin: 2.17, zMax: 2.83 },
  'Low-In':     { xMin: -0.83, xMax: -0.28, zMin: 1.5,  zMax: 2.17 },
  'Low-Mid':    { xMin: -0.28, xMax: 0.28,  zMin: 1.5,  zMax: 2.17 },
  'Low-Out':    { xMin: 0.28,  xMax: 0.83,  zMin: 1.5,  zMax: 2.17 },
} as const;

const template: QueryTemplate = {
  id: 'hitter-hot-cold-zones',
  name: 'Hitter Hot/Cold Zones',
  category: 'hitter',
  description: '3x3 strike zone grid with BA, SLG, whiff rate, and pitch count per zone',
  preferredSources: ['savant'],
  requiredParams: ['player'],
  optionalParams: ['season'],
  examples: [
    'bbdata query hitter-hot-cold-zones --player "Shohei Ohtani" --season 2025',
  ],

  buildQuery(params) {
    return {
      player_name: params.player,
      season: params.season ?? new Date().getFullYear(),
      stat_type: 'batting',
    };
  },

  columns() {
    return ['Zone', 'Pitches', 'Swings', 'Whiff %', 'AVG', 'SLG'];
  },

  transform(data) {
    const pitches = data as PitchData[];
    if (pitches.length === 0) return [];

    return Object.entries(ZONES).map(([zoneName, bounds]) => {
      const inZone = pitches.filter(
        (p) =>
          p.plate_x >= bounds.xMin && p.plate_x < bounds.xMax &&
          p.plate_z >= bounds.zMin && p.plate_z < bounds.zMax,
      );

      const swings = inZone.filter((p) =>
        p.description.includes('swing') || p.description.includes('foul') || p.description.includes('hit_into_play'),
      );
      const whiffs = inZone.filter((p) => p.description.includes('swinging_strike'));

      const abs = inZone.filter((p) => p.events && !['walk', 'hit_by_pitch'].includes(p.events));
      const hits = abs.filter((p) =>
        ['single', 'double', 'triple', 'home_run'].includes(p.events ?? ''),
      );
      const totalBases = abs.reduce((sum, p) => {
        if (p.events === 'single') return sum + 1;
        if (p.events === 'double') return sum + 2;
        if (p.events === 'triple') return sum + 3;
        if (p.events === 'home_run') return sum + 4;
        return sum;
      }, 0);

      return {
        Zone: zoneName,
        Pitches: inZone.length,
        Swings: swings.length,
        'Whiff %': swings.length > 0 ? ((whiffs.length / swings.length) * 100).toFixed(1) + '%' : '—',
        AVG: abs.length > 0 ? (hits.length / abs.length).toFixed(3) : '—',
        SLG: abs.length > 0 ? (totalBases / abs.length).toFixed(3) : '—',
      };
    });
  },
};

registerTemplate(template);
