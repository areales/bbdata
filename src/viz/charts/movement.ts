import type { ChartBuilder, ResolvedVizOptions } from '../types.js';
import { audienceConfig, AUDIENCE_DEFAULTS } from '../audience.js';
import {
  MOVEMENT_DOMAIN,
  meanMarkerLayers,
  movementEncoding,
  movementSide,
  pitchMeans,
  toMovementValues,
  zeroLineLayers,
  type MovementPitch,
} from './movement-values.js';

/**
 * Pitch Movement Plot
 *
 * Horizontal break (-pfx_x, catcher POV) vs induced vertical break (pfx_z).
 * Each pitch plotted as a point, colored by pitch type, with a labeled
 * marker at each pitch type's mean location (the "shape" of the arsenal).
 *
 * 2026-09 redesign: square plot, fixed pitch-type colors (a slider is the
 * same blue on every chart), small translucent points so a 450-pitch
 * fastball cluster reads as a cloud instead of a blob, and mean markers
 * drawn on top with a label. Print/dark/colorblind add shape per pitch.
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
    const pitches = (rows['pitcher-raw-pitches'] ?? []) as MovementPitch[];
    const values = toMovementValues(pitches);
    const means = pitchMeans(values);
    const enc = movementEncoding(values, options);
    const d = AUDIENCE_DEFAULTS[options.audience];
    const side = movementSide(options);
    // Point size and opacity trade off against volume: a full-season SP is
    // ~1,400 pitches at analyst size, so the points get small and faint.
    const dense = values.length > 600;
    const pointSize = Math.round(d.axisLabelFontSize * (dense ? 1.6 : 2.6));
    const pointOpacity = dense ? 0.35 : 0.5;

    return {
      $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
      title: {
        text: options.title,
        subtitle: `${values.length} pitches · ${enc.domain.length} pitch types · inches, catcher's view`,
      },
      width: side,
      height: side,
      layer: [
        ...zeroLineLayers(options),
        {
          data: { values },
          mark: { type: 'point', filled: true, opacity: pointOpacity, size: pointSize, strokeWidth: 0 },
          encoding: {
            x: {
              field: 'hBreak',
              type: 'quantitative',
              scale: { domain: MOVEMENT_DOMAIN },
              axis: { title: 'Horizontal break (in) · catcher POV', tickCount: 5 },
            },
            y: {
              field: 'vBreak',
              type: 'quantitative',
              scale: { domain: MOVEMENT_DOMAIN },
              axis: { title: 'Induced vertical break (in)', tickCount: 5 },
            },
            color: {
              field: 'pitch_type',
              type: 'nominal',
              scale: { domain: enc.domain, range: enc.colorRange },
              legend: { title: 'Pitch', symbolOpacity: 1 },
            },
            ...(enc.useShape
              ? {
                  shape: {
                    field: 'pitch_type',
                    type: 'nominal',
                    scale: { domain: enc.domain, range: enc.shapeRange },
                    legend: { title: 'Pitch' },
                  },
                }
              : {}),
            tooltip: [
              { field: 'pitch_type', title: 'Type' },
              { field: 'velo', title: 'Velo (mph)', format: '.1f' },
              { field: 'hBreak', title: 'H Break (in)', format: '.1f' },
              { field: 'vBreak', title: 'V Break (in)', format: '.1f' },
            ],
          },
        },
        ...meanMarkerLayers(means, enc, options),
      ],
      config: audienceConfig(options.audience, { colorblind: options.colorblind, theme: options.theme }),
    };
  },
};
