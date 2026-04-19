import type { ChartBuilder, ResolvedVizOptions } from '../types.js';
import { audienceConfig } from '../audience.js';

/**
 * Pitch Movement Plot
 *
 * Horizontal break (-pfx_x, catcher POV) vs induced vertical break (pfx_z).
 * Each pitch plotted as a point, colored by pitch type, with a cross mark
 * at each pitch type's mean location (the "shape" of the arsenal).
 */
export const movementBuilder: ChartBuilder = {
  id: 'movement',

  dataRequirements: [
    { queryTemplate: 'pitcher-raw-pitches', required: true },
  ],

  defaultTitle({ player, season }) {
    return `${player} — Pitch Movement (${season})`;
  },

  buildSpec(rows, options: ResolvedVizOptions) {
    const pitches = (rows['pitcher-raw-pitches'] ?? []) as Array<{
      pitch_type: string;
      pfx_x: number;
      pfx_z: number;
      release_speed: number;
    }>;

    // Convert inches and flip x for catcher POV (pitcher's glove side = negative)
    const values = pitches.map((p) => ({
      pitch_type: p.pitch_type,
      hBreak: -p.pfx_x * 12, // feet → inches, flipped
      vBreak: p.pfx_z * 12,
      velo: p.release_speed,
    }));

    return {
      $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
      title: options.title,
      width: options.width,
      height: options.height,
      data: { values },
      layer: [
        {
          mark: { type: 'rule', stroke: '#888', strokeDash: [4, 4] },
          encoding: { x: { datum: 0 } },
        },
        {
          mark: { type: 'rule', stroke: '#888', strokeDash: [4, 4] },
          encoding: { y: { datum: 0 } },
        },
        {
          mark: { type: 'point', filled: true, opacity: 0.65, size: 60 },
          encoding: {
            x: {
              field: 'hBreak',
              type: 'quantitative',
              scale: { domain: [-25, 25] },
              axis: { title: 'Horizontal Break (in, catcher POV)' },
            },
            y: {
              field: 'vBreak',
              type: 'quantitative',
              scale: { domain: [-25, 25] },
              axis: { title: 'Induced Vertical Break (in)' },
            },
            color: {
              field: 'pitch_type',
              type: 'nominal',
              legend: { title: 'Pitch' },
            },
            tooltip: [
              { field: 'pitch_type', title: 'Type' },
              { field: 'velo', title: 'Velo (mph)', format: '.1f' },
              { field: 'hBreak', title: 'H Break (in)', format: '.1f' },
              { field: 'vBreak', title: 'V Break (in)', format: '.1f' },
            ],
          },
        },
        {
          mark: {
            type: 'point',
            shape: 'cross',
            size: 500,
            strokeWidth: 3,
            filled: false,
          },
          encoding: {
            x: { aggregate: 'mean', field: 'hBreak', type: 'quantitative' },
            y: { aggregate: 'mean', field: 'vBreak', type: 'quantitative' },
            color: { field: 'pitch_type', type: 'nominal' },
            detail: { field: 'pitch_type' },
          },
        },
      ],
      config: audienceConfig(options.audience, options.colorblind),
    };
  },
};
