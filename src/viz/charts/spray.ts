import type { ChartBuilder, ResolvedVizOptions } from '../types.js';
import { audienceConfig } from '../audience.js';

/**
 * Spray Chart
 *
 * Batted-ball landing positions on a field diagram. Foul lines and outfield
 * arc are drawn as additional data points inside a single dataset so that
 * Vega-Lite doesn't fight over per-layer axis/scale merging. The `kind`
 * field distinguishes markers ('bip'), foul lines ('foul'), and arc ('arc').
 *
 * Coordinate transform: x' = (hc_x - 125.42) * 2.5, y' = (204 - hc_y) * 2.5
 * (standard Statcast conversion, home plate at origin, center field along +y).
 */
export const sprayBuilder: ChartBuilder = {
  id: 'spray',

  dataRequirements: [
    { queryTemplate: 'hitter-raw-bip', required: true },
  ],

  defaultTitle({ player, season }) {
    return `${player} — Spray Chart (${season})`;
  },

  buildSpec(rows, options: ResolvedVizOptions) {
    const bip = (rows['hitter-raw-bip'] ?? []) as Array<{
      hc_x: number;
      hc_y: number;
      launch_speed: number | null;
      launch_angle: number | null;
      events: string;
    }>;

    const SCALE = 2.5;
    const points = bip.map((b) => ({
      x: (b.hc_x - 125.42) * SCALE,
      y: (204.0 - b.hc_y) * SCALE,
      launch_speed: b.launch_speed ?? 0,
      launch_angle: b.launch_angle ?? 0,
      events: b.events,
    }));

    // Outfield arc — half-circle from left foul (-297, 297) through CF (0, 420) to right foul (297, 297)
    // Parametrized so the endpoints meet the foul-line tips.
    const arc = Array.from({ length: 37 }, (_, i) => {
      const t = (Math.PI / 4) + (Math.PI / 2) * (i / 36); // 45° → 135°
      return { x: Math.cos(t) * 420 * -1, y: Math.sin(t) * 420 };
    });

    return {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      title: options.title,
      width: options.width,
      height: options.height,
      layer: [
        // Batted-ball points (first layer controls scales/axes for the chart)
        {
          data: { values: points },
          mark: { type: 'circle', opacity: 0.75, stroke: '#333', strokeWidth: 0.5 },
          encoding: {
            x: {
              field: 'x',
              type: 'quantitative',
              scale: { domain: [-450, 450] },
              axis: null,
            },
            y: {
              field: 'y',
              type: 'quantitative',
              scale: { domain: [-50, 500] },
              axis: null,
            },
            size: {
              field: 'launch_speed',
              type: 'quantitative',
              scale: { domain: [60, 115], range: [40, 400] },
              legend: { title: 'Exit Velo' },
            },
            color: {
              field: 'events',
              type: 'nominal',
              scale: {
                domain: [
                  'single',
                  'double',
                  'triple',
                  'home_run',
                  'field_out',
                  'force_out',
                  'grounded_into_double_play',
                ],
                range: [
                  '#4e79a7',
                  '#59a14f',
                  '#edc948',
                  '#e15759',
                  '#bab0ac',
                  '#bab0ac',
                  '#bab0ac',
                ],
              },
              legend: { title: 'Result' },
            },
            tooltip: [
              { field: 'events', title: 'Result' },
              { field: 'launch_speed', title: 'EV', format: '.1f' },
              { field: 'launch_angle', title: 'LA', format: '.0f' },
            ],
          },
        },
        // Foul lines — left field
        {
          data: { values: [{ x: 0, y: 0 }, { x: -297, y: 297 }] },
          mark: { type: 'line', stroke: '#888', strokeWidth: 1.5 },
          encoding: {
            x: { field: 'x', type: 'quantitative' },
            y: { field: 'y', type: 'quantitative' },
          },
        },
        // Foul lines — right field
        {
          data: { values: [{ x: 0, y: 0 }, { x: 297, y: 297 }] },
          mark: { type: 'line', stroke: '#888', strokeWidth: 1.5 },
          encoding: {
            x: { field: 'x', type: 'quantitative' },
            y: { field: 'y', type: 'quantitative' },
          },
        },
        // Outfield arc
        {
          data: { values: arc },
          mark: { type: 'line', stroke: '#999', strokeDash: [6, 4], strokeWidth: 1.5 },
          encoding: {
            x: { field: 'x', type: 'quantitative' },
            y: { field: 'y', type: 'quantitative' },
          },
        },
      ],
      config: {
        ...audienceConfig(options.audience, options.colorblind),
        axis: { grid: false, domain: false, ticks: false, labels: false },
      },
    };
  },
};
