import type { ChartBuilder, ResolvedVizOptions } from '../types.js';
import { audienceConfig, AUDIENCE_DEFAULTS } from '../audience.js';
import {
  RESULT_DOMAIN,
  RESULT_SHAPES,
  THEMES,
  resultColors,
  resultLabel,
} from '../theme.js';

/**
 * Spray Chart
 *
 * Batted-ball landing positions on a schematic field. Field guides (foul
 * lines, infield diamond, distance rings, fence arc) are separate data
 * layers; the batted-ball layer goes first so it owns the scales.
 *
 * Coordinate transform: x' = (hc_x - 125.42) * 2.5, y' = (204 - hc_y) * 2.5
 * (standard Statcast conversion, home plate at origin, center field along +y).
 * Units after the transform are roughly feet.
 *
 * 2026-09 redesign: results carry display labels (Single … Home run, and
 * everything that isn't a hit is "Out" — no more raw Savant enums and no more
 * unmapped hollow circles), the foul lines end on the fence arc instead of
 * past it, an infield diamond and two distance rings give the reader a scale,
 * exit velocity still sizes the mark, and the print/dark/colorblind modes add
 * shape so a result never rides on hue alone.
 */

/** Schematic fence: a 400-ft arc from foul line to foul line. */
const FENCE_FT = 400;
const RING_FT = [200, 300];
const BASE_PATH_FT = 90;

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
      hc_x: number | null;
      hc_y: number | null;
      launch_speed: number | null;
      launch_angle: number | null;
      events: string;
    }>;
    const t = THEMES[options.theme];
    const d = AUDIENCE_DEFAULTS[options.audience];
    const useShape = options.theme !== 'light' || options.colorblind;

    // hitter-raw-bip retains coordinate-less batted balls (P3.6) so
    // aggregate counts stay honest; they can't be placed on the field,
    // and `null - 125.42` would coerce to a phantom point otherwise.
    const SCALE = 2.5;
    const points = bip.flatMap((b) => {
      if (b.hc_x == null || b.hc_y == null) return [];
      return [{
        x: (b.hc_x - 125.42) * SCALE,
        y: (204.0 - b.hc_y) * SCALE,
        launch_speed: b.launch_speed ?? 0,
        launch_angle: b.launch_angle ?? 0,
        events: b.events,
        result: resultLabel(b.events),
      }];
    });
    // Hits draw last so an out never covers a home run.
    const drawOrder = (r: string) => (r === 'Out' ? 0 : 1);
    points.sort((a, b) => drawOrder(a.result) - drawOrder(b.result));

    const foulTip = FENCE_FT * Math.SQRT1_2; // where a 45° foul line meets the arc
    const arcPoints = (radius: number, n = 48) =>
      Array.from({ length: n + 1 }, (_, i) => {
        const a = Math.PI / 4 + (Math.PI / 2) * (i / n); // 45° → 135°
        return { x: -Math.cos(a) * radius, y: Math.sin(a) * radius, r: radius };
      });
    const fence = arcPoints(FENCE_FT);
    const rings = RING_FT.flatMap((r) => arcPoints(r, 32));
    const ringLabels = RING_FT.map((r) => ({ x: 0, y: r, label: `${r} ft` }));
    const foulLines = [
      { line: 'L', x: 0, y: 0 }, { line: 'L', x: -foulTip, y: foulTip },
      { line: 'R', x: 0, y: 0 }, { line: 'R', x: foulTip, y: foulTip },
    ];
    const half = BASE_PATH_FT * Math.SQRT1_2;
    const diamond = [
      { x: 0, y: 0 }, { x: half, y: half }, { x: 0, y: 2 * half }, { x: -half, y: half }, { x: 0, y: 0 },
    ].map((p, i) => ({ ...p, order: i }));

    // Equal feet per pixel on both axes, or the fence arc isn't a circle:
    // the requested canvas is the bounding box, the x span is the wider
    // one, so width fills it and height follows the y span.
    const xDomain: [number, number] = [-FENCE_FT - 20, FENCE_FT + 20];
    const yDomain: [number, number] = [-30, FENCE_FT + 30];
    const ftPerPx = Math.max(
      (xDomain[1] - xDomain[0]) / options.width,
      (yDomain[1] - yDomain[0]) / options.height,
    );
    const width = Math.round((xDomain[1] - xDomain[0]) / ftPerPx);
    const height = Math.round((yDomain[1] - yDomain[0]) / ftPerPx);
    const colors = resultColors(options.theme);
    const present = new Set(points.map((p) => p.result));
    const domain = RESULT_DOMAIN.filter((r) => present.has(r));
    const range = RESULT_DOMAIN.map((r, i) => colors[i]).filter((_, i) => present.has(RESULT_DOMAIN[i]));
    const shapes = RESULT_DOMAIN.map((r, i) => RESULT_SHAPES[i]).filter((_, i) => present.has(RESULT_DOMAIN[i]));
    const guideLine = { type: 'line', stroke: t.axis, strokeWidth: 1, strokeJoin: 'round' as const };

    return {
      $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
      title: {
        text: options.title,
        subtitle: `${points.length} batted balls · schematic field, fence drawn at ${FENCE_FT} ft`,
      },
      width,
      height,
      layer: [
        // Batted-ball points (first layer controls scales/axes for the chart)
        {
          data: { values: points },
          mark: {
            type: 'point',
            filled: true,
            opacity: 0.8,
            stroke: t.surface,
            strokeWidth: 1,
            strokeOpacity: 0.9,
          },
          encoding: {
            x: {
              field: 'x',
              type: 'quantitative',
              scale: { domain: xDomain },
              axis: null,
            },
            y: {
              field: 'y',
              type: 'quantitative',
              scale: { domain: yDomain },
              axis: null,
            },
            size: {
              field: 'launch_speed',
              type: 'quantitative',
              scale: { domain: [60, 115], range: [d.axisLabelFontSize * 2, d.axisLabelFontSize * 14] },
              legend: { title: 'Exit velo (mph)', values: [70, 90, 110], symbolFillColor: t.neutral, symbolStrokeWidth: 0 },
            },
            color: {
              field: 'result',
              type: 'nominal',
              scale: { domain, range },
              legend: { title: 'Result' },
            },
            ...(useShape
              ? {
                  shape: {
                    field: 'result',
                    type: 'nominal',
                    scale: { domain, range: shapes },
                    legend: { title: 'Result' },
                  },
                }
              : {}),
            order: { field: 'result', type: 'nominal', sort: ['Out', 'Single', 'Double', 'Triple', 'Home run'] },
            tooltip: [
              { field: 'result', title: 'Result' },
              { field: 'launch_speed', title: 'EV', format: '.1f' },
              { field: 'launch_angle', title: 'LA', format: '.0f' },
            ],
          },
        },
        // Distance rings — hairline, one step off the surface
        {
          data: { values: rings },
          mark: { type: 'line', stroke: t.grid, strokeWidth: 1 },
          encoding: {
            x: { field: 'x', type: 'quantitative' },
            y: { field: 'y', type: 'quantitative' },
            detail: { field: 'r', type: 'nominal' },
          },
        },
        {
          data: { values: ringLabels },
          mark: { type: 'text', dy: -6, fontSize: Math.max(9, d.axisLabelFontSize - 2), color: t.muted },
          encoding: {
            x: { field: 'x', type: 'quantitative' },
            y: { field: 'y', type: 'quantitative' },
            text: { field: 'label', type: 'nominal' },
          },
        },
        // Infield diamond
        {
          data: { values: diamond },
          mark: guideLine,
          encoding: {
            x: { field: 'x', type: 'quantitative' },
            y: { field: 'y', type: 'quantitative' },
            order: { field: 'order', type: 'quantitative' },
          },
        },
        // Foul lines, home plate to the fence arc
        {
          data: { values: foulLines },
          mark: guideLine,
          encoding: {
            x: { field: 'x', type: 'quantitative' },
            y: { field: 'y', type: 'quantitative' },
            detail: { field: 'line', type: 'nominal' },
          },
        },
        // Fence arc
        {
          data: { values: fence },
          mark: { type: 'line', stroke: t.axis, strokeWidth: 1.5 },
          encoding: {
            x: { field: 'x', type: 'quantitative' },
            y: { field: 'y', type: 'quantitative' },
          },
        },
      ],
      config: {
        ...audienceConfig(options.audience, { colorblind: options.colorblind, theme: options.theme }),
        axis: { grid: false, domain: false, ticks: false, labels: false },
      },
    };
  },
};
