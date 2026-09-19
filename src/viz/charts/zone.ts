import type { ChartBuilder, ResolvedVizOptions } from '../types.js';
import { audienceConfig } from '../audience.js';

/**
 * Zone Profile Heatmap
 *
 * 3x3 strike zone grid with each cell colored by xwOBA. Text label in each
 * cell shows the xwOBA value. Uses the `hitter-zone-grid` query template
 * which returns 9 rows with numeric row/col/xwoba.
 */
export const zoneBuilder: ChartBuilder = {
  id: 'zone',

  dataRequirements: [
    { queryTemplate: 'hitter-zone-grid', required: true },
  ],

  defaultTitle({ player, season }) {
    return `${player} — Zone Profile, xwOBA (${season})`;
  },

  buildSpec(rows, options: ResolvedVizOptions) {
    const grid = (rows['hitter-zone-grid'] ?? []) as Array<{
      zone: string;
      row: number;
      col: number;
      pitches: number;
      xwoba: number;
    }>;

    // The color domain starts at the league-wide realistic range for xwOBA
    // (~.200 is Mendoza-esque; ~.500 is MVP-tier) and widens to cover the
    // data. It used to be pinned to [0.2, 0.5] with clamp, which painted
    // every hot cell of an elite hitter the same red — Judge 2026 had five
    // cells from .540 to .672 that the legend could not tell apart. Values
    // are rounded outward to 0.05 so the legend ticks land on clean stops.
    const xwobas = grid.map((c) => c.xwoba).filter((v) => Number.isFinite(v));
    const STEP = 0.05;
    const domainMin = Math.min(0.2, ...xwobas);
    const domainMax = Math.max(0.5, ...xwobas);
    const domain = [
      Math.floor(domainMin / STEP) * STEP,
      Math.ceil(domainMax / STEP) * STEP,
    ].map((v) => Number(v.toFixed(2)));

    return {
      $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
      title: options.title,
      width: options.width,
      height: options.height,
      data: { values: grid },
      layer: [
        {
          mark: { type: 'rect', stroke: '#222', strokeWidth: 1.5 },
          encoding: {
            x: {
              field: 'col',
              type: 'ordinal',
              axis: { title: 'Inside  →  Outside', labels: false, ticks: false },
            },
            y: {
              field: 'row',
              type: 'ordinal',
              axis: { title: 'High  →  Low', labels: false, ticks: false },
            },
            color: {
              field: 'xwoba',
              type: 'quantitative',
              // `clamp: true` stays as a guard for NaN/out-of-range edge
              // cases; with the widened domain it no longer flattens data.
              scale: options.colorblind
                ? { scheme: 'viridis', domain, clamp: true }
                : {
                    scheme: 'redyellowblue',
                    reverse: true,
                    domain,
                    clamp: true,
                  },
              legend: { title: 'xwOBA' },
            },
            tooltip: [
              { field: 'zone', title: 'Zone' },
              { field: 'pitches', title: 'Pitches' },
              { field: 'pa', title: 'PAs' },
              { field: 'xwoba', title: 'xwOBA', format: '.3f' },
            ],
          },
        },
        {
          mark: {
            type: 'text',
            fontSize: 18,
            fontWeight: 'bold',
            // Halo stroke keeps text legible against every cell color —
            // light (yellow) and dark (saturated red or blue) alike.
            stroke: 'white',
            strokeWidth: 3,
            strokeOpacity: 0.9,
            paintOrder: 'stroke',
          },
          encoding: {
            x: { field: 'col', type: 'ordinal' },
            y: { field: 'row', type: 'ordinal' },
            text: { field: 'xwoba', type: 'quantitative', format: '.3f' },
            color: { value: 'black' },
          },
        },
      ],
      config: audienceConfig(options.audience, options.colorblind),
    };
  },
};
