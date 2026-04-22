import type { ChartBuilder, ResolvedVizOptions } from '../types.js';
import { audienceConfig } from '../audience.js';

/**
 * Pitcher Rolling Performance Trend
 *
 * Sibling to the (hitter-oriented) `rolling` chart. Consumes the
 * `pitcher-rolling-trend` query template, which returns wide string rows
 * keyed by start date with pitcher-specific metrics (Avg Velo, Whiff %,
 * K %, CSW %), and pivots to tidy `{ window_end, metric, value }` for
 * a faceted small-multiples line chart.
 *
 * Kept as a separate chart type rather than a runtime branch inside
 * `rolling` so the two stat vocabularies (batting averages vs pitching
 * rate stats) stay in their own modules and don't silently cross over
 * when one side changes columns.
 */

interface RollingRow {
  [key: string]: unknown;
}

function parseNumeric(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).replace(/[^\d.-]/g, '');
  if (!s) return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function isParseableDate(v: unknown): boolean {
  if (v == null || v === '') return false;
  const s = String(v);
  if (!/[-/]/.test(s)) return false;
  const t = Date.parse(s);
  return Number.isFinite(t);
}

export const pitcherRollingBuilder: ChartBuilder = {
  id: 'pitcher-rolling',

  dataRequirements: [
    { queryTemplate: 'pitcher-rolling-trend', required: true },
  ],

  defaultTitle({ player, season }) {
    return `${player} — Rolling Performance (${season})`;
  },

  buildSpec(rows, options: ResolvedVizOptions) {
    const wideRows = (rows['pitcher-rolling-trend'] ?? []) as RollingRow[];

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

    // Metric keys = all non-date keys whose values parse as numeric.
    // Exclude the raw `Starts` count (parallels the hitter rolling chart
    // excluding `Games`) — it's a denominator, not a performance metric,
    // and would otherwise dominate the shared facet.
    const metricKeys = new Set<string>();
    const excluded = new Set([dateKey, 'Window', 'Starts'].filter(Boolean));
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

    if (tidy.length === 0) {
      return {
        $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
        title: options.title,
        width: options.width,
        height: options.height,
        data: { values: [{ msg: 'Insufficient data for rolling trend (need 5+ starts)' }] },
        mark: { type: 'text', fontSize: 14, color: '#888' },
        encoding: { text: { field: 'msg', type: 'nominal' } },
        config: audienceConfig(options.audience, options.colorblind),
      };
    }

    const metricOrder = Array.from(metricKeys);
    const panelHeight = Math.max(80, Math.floor(options.height / metricOrder.length) - 30);

    return {
      $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
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
