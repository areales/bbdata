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
  const s = String(v).replace(/[^\d.-]/g, '');
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

    // Identify the date column. Prefer explicit ISO-date columns; fall back
    // to checking each candidate for a value that Date.parse() accepts.
    const preferredKeys = ['Window End', 'window_end', 'Date', 'date', 'End Date'];
    let dateKey: string | null = null;
    if (wideRows.length > 0) {
      const first = wideRows[0] as RollingRow;
      for (const k of preferredKeys) {
        if (k in first && isParseableDate(first[k])) {
          dateKey = k;
          break;
        }
      }
    }

    // Metric keys = all non-date keys whose values parse as numeric
    // AND are not the raw "Games" count (which dominates the scale).
    const metricKeys = new Set<string>();
    const excluded = new Set([dateKey, 'Window', 'Games'].filter(Boolean));
    for (const r of wideRows) {
      for (const k of Object.keys(r)) {
        if (excluded.has(k)) continue;
        if (parseNumeric(r[k]) != null) metricKeys.add(k);
      }
    }

    const tidy: Array<{ window_end: string; metric: string; value: number }> = [];
    for (const r of wideRows) {
      const date = dateKey ? String(r[dateKey] ?? '') : '';
      if (!date || !isParseableDate(date)) continue;
      for (const k of metricKeys) {
        const n = parseNumeric(r[k]);
        if (n != null) tidy.push({ window_end: date, metric: k, value: n });
      }
    }

    // Graceful degradation — no usable rows means we can't draw a trend.
    // Emit a single text mark explaining why instead of a blank chart.
    if (tidy.length === 0) {
      return {
        $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
        title: options.title,
        width: options.width,
        height: options.height,
        data: { values: [{ msg: 'Insufficient data for rolling trend (need 15+ games)' }] },
        mark: { type: 'text', fontSize: 14, color: '#888' },
        encoding: { text: { field: 'msg', type: 'nominal' } },
        config: audienceConfig(options.audience, options.colorblind),
      };
    }

    // Use faceted small multiples so metrics with different scales
    // (e.g., AVG ~0.3 vs Avg EV ~90 mph) each get their own y-axis.
    // Shared x (time) across panels; independent y per metric.
    const metricOrder = Array.from(metricKeys);
    const panelHeight = Math.max(80, Math.floor(options.height / metricOrder.length) - 30);

    return {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      title: options.title,
      data: { values: tidy },
      facet: {
        row: {
          field: 'metric',
          type: 'nominal',
          title: null,
          header: { labelAngle: 0, labelAlign: 'left', labelFontWeight: 'bold' },
          sort: metricOrder,
        },
      },
      spec: {
        width: options.width - 120,
        height: panelHeight,
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
                axis: { title: null },
                scale: { zero: false },
              },
              color: {
                field: 'metric',
                type: 'nominal',
                legend: null,
              },
              tooltip: [
                { field: 'window_end', type: 'temporal', format: '%Y-%m-%d' },
                { field: 'metric', title: 'Metric' },
                { field: 'value', title: 'Value', format: '.3f' },
              ],
            },
          },
          {
            mark: { type: 'rule', strokeDash: [4, 4], opacity: 0.4 },
            encoding: {
              y: { aggregate: 'mean', field: 'value', type: 'quantitative' },
              color: { field: 'metric', type: 'nominal', legend: null },
            },
          },
        ],
      },
      resolve: { scale: { y: 'independent' } },
      config: audienceConfig(options.audience, options.colorblind),
    };
  },
};

function isParseableDate(v: unknown): boolean {
  if (v == null || v === '') return false;
  const s = String(v);
  // Guard against pure numbers (e.g., '1', '15' are technically parseable
  // as year-only but not what we want) — require at least YYYY-MM or MM/DD.
  if (!/[-/]/.test(s)) return false;
  const t = Date.parse(s);
  return Number.isFinite(t);
}
