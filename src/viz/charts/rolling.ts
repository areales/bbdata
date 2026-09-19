import type { ChartBuilder, ResolvedVizOptions } from '../types.js';
import { audienceConfig } from '../audience.js';
import { buildRollingSpec, pivotRollingRows } from './rolling-facets.js';

/**
 * Rolling Performance Trend (hitters)
 *
 * Time-series chart of rolling-window metrics. Consumes the existing
 * `trend-rolling-average` query template (which returns wide string rows)
 * and pivots to tidy `{ window_end, metric, value }` in memory. The spec
 * itself is shared with `pitcher-rolling` (see rolling-facets.ts).
 */
export const rollingBuilder: ChartBuilder = {
  id: 'rolling',

  dataRequirements: [
    { queryTemplate: 'trend-rolling-average', required: true },
  ],

  defaultTitle({ player, season }) {
    return `${player} — Rolling Performance (${season})`;
  },

  buildSpec(rows, options: ResolvedVizOptions) {
    const wideRows = (rows['trend-rolling-average'] ?? []) as Record<string, unknown>[];
    const pivot = pivotRollingRows(wideRows, ['Games']);

    // Graceful degradation — no usable rows means we can't draw a trend.
    // Emit a single text mark explaining why instead of a blank chart.
    if (pivot.tidy.length === 0) {
      return {
        $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
        title: options.title,
        width: options.width,
        height: options.height,
        data: { values: [{ msg: 'Insufficient data for rolling trend (need 15+ games)' }] },
        mark: { type: 'text', fontSize: 14, color: '#888' },
        encoding: { text: { field: 'msg', type: 'nominal' } },
        config: audienceConfig(options.audience, { colorblind: options.colorblind, theme: options.theme }),
      };
    }

    const n = options.window ?? pivot.windowSize ?? 15;
    return buildRollingSpec({
      tidy: pivot.tidy,
      metrics: pivot.metrics,
      options,
      windowLabel: `${n}-game windows`,
      span: pivot.span,
    });
  },
};
