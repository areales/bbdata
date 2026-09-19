import type { ChartBuilder, ResolvedVizOptions } from '../types.js';
import { audienceConfig } from '../audience.js';
import { THEMES } from '../theme.js';
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

/** Square bins, in inches, on both axes. */
export const BIN_STEP_IN = 2.5;

/**
 * Pitch Movement Plot — binned "count bubbles" variant
 *
 * Same horizontal-break × induced-vertical-break space as the standard
 * `movement` chart, but the per-pitch point layer is replaced with one
 * circle per (2.5-in square bin, pitch type), sized by pitch count and
 * colored by pitch type. The labeled mean markers are kept so coaches
 * still get the "arsenal shape" summary.
 *
 * This variant exists because the per-pitch movement chart can emit
 * 1,400+ marks for a full-season SP, producing ~1.4 MB of inline SVG.
 * Binning bounds the mark count (at most 20×20 per pitch type) for
 * reports that embed the chart inline (e.g. `advance-sp`).
 *
 * 2026-09 redesign: the previous rect heatmap used 5×2-in bins (a
 * rectangle, so density wasn't comparable across axes) in a single blue
 * ramp with tableau crosses on top — the changeup cross vanished on a
 * mid-blue cell. Square bins, area for count, hue for pitch type.
 */
export const movementBinnedBuilder: ChartBuilder = {
  id: 'movement-binned',

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
    const side = movementSide(options);
    // A bin cell is `side / 20` px on a side; the largest bubble fills it.
    const cellPx = side / ((MOVEMENT_DOMAIN[1] - MOVEMENT_DOMAIN[0]) / BIN_STEP_IN);
    const maxArea = Math.round(cellPx * cellPx * 0.7);
    const bin = { step: BIN_STEP_IN, extent: MOVEMENT_DOMAIN };
    const ticks = [-20, -10, 0, 10, 20];
    // Legend steps stop at roughly the largest bin a season produces.
    const legendValues = [25, 50, 100, 200].filter((v, i) => i === 0 || v <= values.length / 4);

    return {
      $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
      title: {
        text: options.title,
        subtitle: `${values.length} pitches · ${enc.domain.length} pitch types · circle area = pitches per ${BIN_STEP_IN}-in bin`,
      },
      width: side,
      height: side,
      layer: [
        ...zeroLineLayers(options),
        {
          data: { values },
          mark: { type: 'point', filled: true, opacity: 0.75, stroke: 'transparent' },
          encoding: {
            x: {
              field: 'hBreak',
              type: 'quantitative',
              bin,
              scale: { domain: MOVEMENT_DOMAIN },
              axis: { title: 'Horizontal break (in) · catcher POV', values: ticks, grid: true },
            },
            y: {
              field: 'vBreak',
              type: 'quantitative',
              bin,
              scale: { domain: MOVEMENT_DOMAIN },
              axis: { title: 'Induced vertical break (in)', values: ticks, grid: true },
            },
            size: {
              aggregate: 'count',
              type: 'quantitative',
              scale: { range: [4, maxArea], zero: true },
              legend: { title: 'Pitches per bin', values: legendValues, symbolFillColor: THEMES[options.theme].neutral, symbolStrokeWidth: 0 },
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
              { aggregate: 'count', title: 'Pitches' },
            ],
          },
        },
        ...meanMarkerLayers(means, enc, options),
      ],
      config: audienceConfig(options.audience, { colorblind: options.colorblind, theme: options.theme }),
    };
  },
};
