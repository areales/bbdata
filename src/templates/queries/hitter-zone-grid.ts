import { registerTemplate, type QueryTemplate } from './registry.js';
import type { PitchData } from '../../adapters/types.js';

// 3x3 strike zone grid (copied from hitter-hot-cold-zones.ts)
// row: 0 = high, 2 = low. col: 0 = inside (catcher POV left), 2 = outside.
const ZONES: { name: string; row: number; col: number; xMin: number; xMax: number; zMin: number; zMax: number }[] = [
  { name: 'High-In',  row: 0, col: 0, xMin: -0.83, xMax: -0.28, zMin: 2.83, zMax: 3.5  },
  { name: 'High-Mid', row: 0, col: 1, xMin: -0.28, xMax:  0.28, zMin: 2.83, zMax: 3.5  },
  { name: 'High-Out', row: 0, col: 2, xMin:  0.28, xMax:  0.83, zMin: 2.83, zMax: 3.5  },
  { name: 'Mid-In',   row: 1, col: 0, xMin: -0.83, xMax: -0.28, zMin: 2.17, zMax: 2.83 },
  { name: 'Mid-Mid',  row: 1, col: 1, xMin: -0.28, xMax:  0.28, zMin: 2.17, zMax: 2.83 },
  { name: 'Mid-Out',  row: 1, col: 2, xMin:  0.28, xMax:  0.83, zMin: 2.17, zMax: 2.83 },
  { name: 'Low-In',   row: 2, col: 0, xMin: -0.83, xMax: -0.28, zMin: 1.5,  zMax: 2.17 },
  { name: 'Low-Mid',  row: 2, col: 1, xMin: -0.28, xMax:  0.28, zMin: 1.5,  zMax: 2.17 },
  { name: 'Low-Out',  row: 2, col: 2, xMin:  0.28, xMax:  0.83, zMin: 1.5,  zMax: 2.17 },
];

/**
 * 3x3 zone grid with numeric row/col indices and averaged xwOBA.
 * Powers the zone-profile heatmap visualization. Unlike hitter-hot-cold-zones
 * which returns strings for human display, this returns numerics for charting.
 */
const template: QueryTemplate = {
  id: 'hitter-zone-grid',
  name: 'Hitter Zone Grid (numeric)',
  category: 'hitter',
  description: '3x3 strike zone grid with numeric row/col/xwoba for heatmap visualization',
  preferredSources: ['savant'],
  requiredParams: ['player'],
  optionalParams: ['season'],
  examples: [
    'bbdata query hitter-zone-grid --player "Shohei Ohtani" --format json',
  ],

  buildQuery(params) {
    return {
      player_name: params.player,
      season: params.season ?? new Date().getFullYear(),
      stat_type: 'batting',
    };
  },

  columns() {
    return ['zone', 'row', 'col', 'pitches', 'xwoba'];
  },

  transform(data) {
    const pitches = data as PitchData[];
    if (pitches.length === 0) return [];

    return ZONES.map((z) => {
      const inZone = pitches.filter(
        (p) =>
          p.plate_x >= z.xMin && p.plate_x < z.xMax &&
          p.plate_z >= z.zMin && p.plate_z < z.zMax,
      );
      const withXwoba = inZone.filter((p) => p.estimated_woba != null);
      const xwoba = withXwoba.length > 0
        ? withXwoba.reduce((sum, p) => sum + (p.estimated_woba ?? 0), 0) / withXwoba.length
        : 0;
      return {
        zone: z.name,
        row: z.row,
        col: z.col,
        pitches: inZone.length,
        xwoba: Number(xwoba.toFixed(3)),
      };
    });
  },
};

registerTemplate(template);
