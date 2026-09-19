import type { ChartBuilder, ResolvedVizOptions } from '../types.js';
import { audienceConfig } from '../audience.js';
import { buildRollingSpec, pivotRollingRows } from './rolling-facets.js';

/**
 * Pitcher Rolling Performance Trend
 *
 * Sibling to the (hitter-oriented) `rolling` chart. Consumes the
 * `pitcher-rolling-trend` query template, which returns wide string rows
 * keyed by start date with pitcher-specific metrics (Avg Velo, Whiff %,
 * K %, CSW %), and pivots to tidy `{ window_end, metric, value }` for
 * the shared faceted small-multiples spec (rolling-facets.ts).
 *
 * Kept as a separate chart type rather than a runtime branch inside
 * `rolling` so the two stat vocabularies (batting averages vs pitching
 * rate stats) stay in their own modules and don't silently cross over
 * when one side changes columns.
 */
export const pitcherRollingBuilder: ChartBuilder = {
  id: 'pitcher-rolling',

  dataRequirements: [
    { queryTemplate: 'pitcher-rolling-trend', required: true },
  ],

  defaultTitle({ player, season }) {
    return `${player} — Rolling Performance (${season})`;
  },

  buildSpec(rows, options: ResolvedVizOptions) {
    const wideRows = (rows['pitcher-rolling-trend'] ?? []) as Record<string, unknown>[];
    // Exclude the raw `Starts` count (parallels the hitter chart excluding
    // `Games`) — it's a denominator, not a performance metric.
    const pivot = pivotRollingRows(wideRows, ['Starts']);

    if (pivot.tidy.length === 0) {
      return {
        $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
        title: options.title,
        width: options.width,
        height: options.height,
        data: { values: [{ msg: 'Insufficient data for rolling trend (need 5+ starts)' }] },
        mark: { type: 'text', fontSize: 14, color: '#888' },
        encoding: { text: { field: 'msg', type: 'nominal' } },
        config: audienceConfig(options.audience, { colorblind: options.colorblind, theme: options.theme }),
      };
    }

    const n = options.window ?? pivot.windowSize ?? 5;
    return buildRollingSpec({
      tidy: pivot.tidy,
      metrics: pivot.metrics,
      options,
      windowLabel: `${n}-start windows`,
      span: pivot.span,
    });
  },
};
