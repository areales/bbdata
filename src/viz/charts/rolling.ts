import type { ChartBuilder, ResolvedVizOptions } from '../types.js';
import { audienceConfig } from '../audience.js';

/**
 * Rolling Performance Trend
 *
 * Time-series chart of rolling-window metrics. Consumes the existing
 * `trend-rolling-average` query template (which returns wide string rows)
 * and pivots to tidy `{ window_end, metric, value }` format in-memory.
 */

interface RollingRow {
  [key: string]: unknown;
}

/** Parse numeric values out of strings like "0.312", "95.2 mph", "35.7%" */
function parseNumeric(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).replace(/[^\d.\-]/g, '');
  if (!s) return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

export const rollingBuilder: ChartBuilder = {
  id: 'rolling',

  dataRequirements: [
    { queryTemplate: 'trend-rolling-average', required: true },
  ],

  defaultTitle({ player, season }) {
    return `${player} — Rolling Performance (${season})`;
  },

  buildSpec(rows, options: ResolvedVizOptions) {
    const wideRows = (rows['trend-rolling-average'] ?? []) as RollingRow[];

    // Identify the date column and metric columns. The template may label
    // the date field 'Window End', 'Date', or similar — try a few names.
    const dateKey =
      wideRows.length > 0
        ? (['Window End', 'window_end', 'Date', 'date', 'End Date'].find(
            (k) => k in (wideRows[0] as RollingRow),
          ) ?? Object.keys(wideRows[0] as RollingRow)[0])
        : null;

    // Metric keys = all non-date keys whose values parse as numeric.
    const metricKeys = new Set<string>();
    for (const r of wideRows) {
      for (const k of Object.keys(r)) {
        if (k === dateKey) continue;
        if (parseNumeric(r[k]) != null) metricKeys.add(k);
      }
    }

    const tidy: Array<{ window_end: string; metric: string; value: number }> = [];
    for (const r of wideRows) {
      const date = dateKey ? String(r[dateKey] ?? '') : '';
      if (!date) continue;
      for (const k of metricKeys) {
        const n = parseNumeric(r[k]);
        if (n != null) tidy.push({ window_end: date, metric: k, value: n });
      }
    }

    return {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      title: options.title,
      width: options.width,
      height: options.height,
      data: { values: tidy },
      layer: [
        {
          mark: { type: 'line', point: true, strokeWidth: 2 },
          encoding: {
            x: {
              field: 'window_end',
              type: 'temporal',
              axis: { title: 'Window End', format: '%b %d' },
            },
            y: {
              field: 'value',
              type: 'quantitative',
              axis: { title: 'Value' },
              scale: { zero: false },
            },
            color: {
              field: 'metric',
              type: 'nominal',
              legend: { title: 'Metric' },
            },
            tooltip: [
              { field: 'window_end', type: 'temporal', format: '%Y-%m-%d' },
              { field: 'metric', title: 'Metric' },
              { field: 'value', title: 'Value', format: '.3f' },
            ],
          },
        },
        {
          mark: { type: 'rule', strokeDash: [4, 4], opacity: 0.5 },
          encoding: {
            y: { aggregate: 'mean', field: 'value', type: 'quantitative' },
            color: { field: 'metric', type: 'nominal' },
          },
        },
      ],
      config: audienceConfig(options.audience, options.colorblind),
    };
  },
};
