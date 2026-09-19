import type { ChartBuilder, ResolvedVizOptions } from '../types.js';
import { audienceConfig, AUDIENCE_DEFAULTS } from '../audience.js';
import { THEMES, formatRate } from '../theme.js';

/**
 * Zone Profile Heatmap
 *
 * 3x3 strike zone grid with each cell colored by xwOBA. Uses the
 * `hitter-zone-grid` query template, which returns 9 rows with numeric
 * row/col/xwoba plus the pitch and PA counts behind each cell.
 *
 * 2026-09 redesign: the zone keeps a strike zone's proportions (17 in wide,
 * ~24 in tall) instead of inheriting the canvas, the axis grid no longer
 * strikes through the labels, the ramp is one hue light → dark (xwOBA is a
 * magnitude, not a polarity), and every cell says how many PAs it rests on.
 */

/** Strike zone proportions: 17 in wide, ~24 in tall (knees to letters). */
const ZONE_ASPECT = 17 / 24;

export const zoneDomain = (xwobas: number[]): [number, number] => {
  // The color domain starts at the league-wide realistic range for xwOBA
  // (~.200 is Mendoza-esque; ~.500 is MVP-tier) and widens to cover the
  // data. It used to be pinned to [0.2, 0.5] with clamp, which painted
  // every hot cell of an elite hitter the same red — Judge 2026 had five
  // cells from .540 to .672 that the legend could not tell apart. Values
  // are rounded outward to 0.05 so the legend ticks land on clean stops.
  const STEP = 0.05;
  const finite = xwobas.filter((v) => Number.isFinite(v));
  const domainMin = Math.min(0.2, ...finite);
  const domainMax = Math.max(0.5, ...finite);
  return [
    Number((Math.floor(domainMin / STEP) * STEP).toFixed(2)),
    Number((Math.ceil(domainMax / STEP) * STEP).toFixed(2)),
  ];
};

export type ZoneCell = {
  zone: string;
  row: number;
  col: number;
  pitches: number;
  pa: number;
  xwoba: number;
};

export function zoneCells(rows: Record<string, Record<string, unknown>[]>): ZoneCell[] {
  return ((rows['hitter-zone-grid'] ?? []) as ZoneCell[]).map((c) => ({
    ...c,
    pa: Number(c.pa ?? 0),
    pitches: Number(c.pitches ?? 0),
    xwoba: Number(c.xwoba),
  }));
}

export const zoneBuilder: ChartBuilder = {
  id: 'zone',

  dataRequirements: [
    { queryTemplate: 'hitter-zone-grid', required: true },
  ],

  defaultTitle({ player, season }) {
    return `${player} — Zone Profile, xwOBA (${season})`;
  },

  buildSpec(rows, options: ResolvedVizOptions) {
    const grid = zoneCells(rows).map((c) => ({
      ...c,
      label: formatRate(c.xwoba),
      sub: `${c.pa} PA`,
    }));
    const t = THEMES[options.theme];
    const d = AUDIENCE_DEFAULTS[options.audience];
    const domain = zoneDomain(grid.map((c) => c.xwoba));
    // Text flips to the surface color on the dark half of the ramp so it
    // clears contrast on every cell without a halo fighting the fill.
    const flipAt = domain[0] + (domain[1] - domain[0]) * (options.theme === 'dark' ? 0.55 : 0.5);
    const inkOnDark = options.theme === 'dark' ? t.ink : t.surface;

    const height = Math.min(options.width, options.height);
    const width = Math.round(height * ZONE_ASPECT);
    const totalPa = grid.reduce((a, c) => a + c.pa, 0);

    return {
      $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
      title: {
        text: options.title,
        subtitle: `xwOBA per region · ${totalPa} PA · catcher's view`,
      },
      width,
      height,
      data: { values: grid },
      layer: [
        {
          // A 2px gap in the surface color separates cells; no border ink.
          mark: { type: 'rect', stroke: t.surface, strokeWidth: 3, cornerRadius: 2 },
          encoding: {
            x: {
              field: 'col',
              type: 'ordinal',
              axis: { title: 'Inside  →  Outside', labels: false, ticks: false, domain: false, grid: false },
              scale: { paddingInner: 0, paddingOuter: 0 },
            },
            y: {
              field: 'row',
              type: 'ordinal',
              axis: { title: 'High  →  Low', labels: false, ticks: false, domain: false, grid: false },
              scale: { paddingInner: 0, paddingOuter: 0 },
            },
            color: {
              field: 'xwoba',
              type: 'quantitative',
              scale: { range: t.sequential, domain, clamp: true, interpolate: 'lab' },
              legend: {
                title: 'xwOBA',
                orient: 'right',
                gradientLength: Math.round(height * 0.5),
                labelExpr: "replace(format(datum.value, '.2f'), /^0\\./, '.')",
                tickCount: 4,
              },
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
            fontSize: Math.round(d.titleFontSize * 1.15),
            fontWeight: 'bold',
            dy: -Math.round(d.axisLabelFontSize * 0.55),
          },
          encoding: {
            x: { field: 'col', type: 'ordinal' },
            y: { field: 'row', type: 'ordinal' },
            text: { field: 'label', type: 'nominal' },
            color: {
              condition: { test: `datum.xwoba >= ${flipAt}`, value: inkOnDark },
              value: t.ink,
            },
          },
        },
        {
          mark: {
            type: 'text',
            fontSize: d.axisLabelFontSize,
            dy: Math.round(d.axisLabelFontSize * 0.95),
            opacity: 0.85,
          },
          encoding: {
            x: { field: 'col', type: 'ordinal' },
            y: { field: 'row', type: 'ordinal' },
            text: { field: 'sub', type: 'nominal' },
            color: {
              condition: { test: `datum.xwoba >= ${flipAt}`, value: inkOnDark },
              value: t.muted,
            },
          },
        },
      ],
      config: audienceConfig(options.audience, { colorblind: options.colorblind, theme: options.theme }),
    };
  },
};
