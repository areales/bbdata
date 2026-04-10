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

    return {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
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
              scale: options.colorblind
                ? { scheme: 'viridis', domain: [0.2, 0.45] }
                : { scheme: 'redyellowblue', reverse: true, domain: [0.2, 0.45] },
              legend: { title: 'xwOBA' },
            },
            tooltip: [
              { field: 'zone', title: 'Zone' },
              { field: 'pitches', title: 'Pitches' },
              { field: 'xwoba', title: 'xwOBA', format: '.3f' },
            ],
          },
        },
        {
          mark: {
            type: 'text',
            fontSize: 18,
            fontWeight: 'bold',
          },
          encoding: {
            x: { field: 'col', type: 'ordinal' },
            y: { field: 'row', type: 'ordinal' },
            text: { field: 'xwoba', type: 'quantitative', format: '.3f' },
            color: {
              condition: { test: 'datum.xwoba > 0.35', value: 'white' },
              value: 'black',
            },
          },
        },
      ],
      config: audienceConfig(options.audience, options.colorblind),
    };
  },
};
