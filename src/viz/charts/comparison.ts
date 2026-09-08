import type { ChartBuilder, ResolvedVizOptions } from '../types.js';
import { COMPARISON_PLAYER_FIELD } from '../types.js';
import { audienceConfig } from '../audience.js';

/**
 * Multi-Player Comparison (P5.1)
 *
 * The chart `--players` was always supposed to drive. Before 0.12 the flag was
 * parsed, stored on ResolvedVizOptions, and read by nobody — M04 L05 taught it
 * as "a comma separated list for the charts that support a comparison" and no
 * chart supported one.
 *
 * Consumes `hitter-season-profile`, which returns a `{ Metric, Value }` table
 * per player (AVG, OBP, SLG, wOBA, wRC+, ISO, HR, BB%, K%, WAR). `viz()` tags
 * each row with the player it came from; this builder pivots that into one
 * faceted panel per metric with a bar per player.
 *
 * Metrics live on wildly different scales — AVG ~0.300 next to wRC+ ~140 —
 * so the facets resolve their y-scale independently, the same approach
 * `rolling.ts` takes for its metric panels.
 */

/**
 * Panel order. Slash line → advanced → power → discipline → value, matching
 * the order `hitter-season-profile` emits so the chart reads like the table.
 * Anything the query returns that isn't listed here still renders, appended
 * after these — the list controls order, it does not filter.
 */
const METRIC_ORDER = [
  'AVG', 'OBP', 'SLG', 'wOBA', 'wRC+', 'ISO', 'HR', 'BB%', 'K%', 'WAR',
];

interface TidyPoint {
  player: string;
  metric: string;
  value: number;
  /** The string bbdata formatted, shown in the tooltip so no precision is implied that the bar doesn't have. */
  display: string;
}

/**
 * Parse the formatted value back to a number for the bar height.
 *
 * `hitter-season-profile` formats before it returns — "0.312", "14.2%", "204",
 * and "—" when FanGraphs had no value. The bar needs a number, so we parse;
 * the ORIGINAL string rides along in `display` and is what the tooltip shows.
 * That keeps the rounding the formatter already applied visible instead of
 * implying the chart knows more digits than the table did.
 *
 * Returns null for "—" and anything else unparseable. A null is a real
 * absence and must not be plotted as zero.
 */
function parseFormatted(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).trim();
  if (s === '' || s === '—' || s === '-') return null;
  const cleaned = s.replace(/[^\d.-]/g, '');
  if (!cleaned || cleaned === '-' || cleaned === '.') return null;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

export const comparisonBuilder: ChartBuilder = {
  id: 'comparison',
  supportsComparison: true,

  dataRequirements: [
    { queryTemplate: 'hitter-season-profile', required: true },
  ],

  defaultTitle({ season }) {
    return `Player Comparison (${season})`;
  },

  buildSpec(rows, options: ResolvedVizOptions) {
    const raw = (rows['hitter-season-profile'] ?? []) as Record<string, unknown>[];

    const tidy: TidyPoint[] = [];
    const seenMetrics = new Set<string>();
    for (const r of raw) {
      const player = String(r[COMPARISON_PLAYER_FIELD] ?? '');
      const metric = String(r['Metric'] ?? '');
      if (!player || !metric) continue;
      const display = String(r['Value'] ?? '—');
      const value = parseFormatted(r['Value']);
      seenMetrics.add(metric);
      // A metric FanGraphs didn't return is dropped from its panel rather than
      // drawn as a zero bar. The player still appears in every other panel, so
      // the gap is visible as a missing bar instead of a false one.
      if (value == null) continue;
      tidy.push({ player, metric, value, display });
    }

    if (tidy.length === 0) {
      return {
        $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
        title: options.title,
        width: options.width,
        height: options.height,
        data: { values: [{ msg: 'No comparable season data for the requested players' }] },
        mark: { type: 'text', fontSize: 14, color: '#888' },
        encoding: { text: { field: 'msg', type: 'nominal' } },
        config: audienceConfig(options.audience, options.colorblind),
      };
    }

    const ordered = [
      ...METRIC_ORDER.filter((m) => seenMetrics.has(m)),
      ...Array.from(seenMetrics).filter((m) => !METRIC_ORDER.includes(m)),
    ];
    const players = options.players ?? [];
    // Three panels per row keeps ten metrics on a readable grid at the
    // default sizes; the audience presets only change the canvas, not this.
    const columns = 3;
    const panelWidth = Math.max(120, Math.floor((options.width - 140) / columns));
    const panelHeight = Math.max(90, Math.floor(options.height / Math.ceil(ordered.length / columns)) - 40);

    return {
      $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
      title: options.title,
      data: { values: tidy },
      facet: {
        field: 'metric',
        type: 'nominal',
        title: null,
        sort: ordered,
        header: { labelFontWeight: 'bold', labelAnchor: 'start' },
      },
      columns,
      spec: {
        width: panelWidth,
        height: panelHeight,
        mark: { type: 'bar', cornerRadiusEnd: 2 },
        encoding: {
          x: {
            field: 'player',
            type: 'nominal',
            axis: { title: null, labelAngle: -35 },
            sort: players.length > 0 ? players : undefined,
          },
          y: {
            field: 'value',
            type: 'quantitative',
            axis: { title: null },
            scale: { zero: true },
          },
          color: {
            field: 'player',
            type: 'nominal',
            legend: { title: null, orient: 'bottom' },
            sort: players.length > 0 ? players : undefined,
          },
          tooltip: [
            { field: 'player', title: 'Player' },
            { field: 'metric', title: 'Metric' },
            // The formatted string, not the parsed number — the chart shows
            // exactly what `bbdata query hitter-season-profile` printed.
            { field: 'display', title: 'Value' },
          ],
        },
      },
      resolve: { scale: { y: 'independent' } },
      config: audienceConfig(options.audience, options.colorblind),
    };
  },
};
