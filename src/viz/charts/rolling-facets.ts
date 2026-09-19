import type { ResolvedVizOptions } from '../types.js';
import { audienceConfig, AUDIENCE_DEFAULTS } from '../audience.js';
import { THEMES, formatRate } from '../theme.js';
import { assignGapSegments, type TidyRow } from './rolling-segments.js';

/**
 * Shared spec builder for the rolling chart family (`rolling` for hitters,
 * `pitcher-rolling` for pitchers). Both pivot a wide window table into tidy
 * `{ window_end, metric, value }` rows and draw one panel per metric with
 * a shared time axis and an independent value axis.
 *
 * 2026-09 redesign, applied to both so they read as one family:
 *   - the metric name sits above its panel, left-aligned in one shared
 *     gutter (the side labels used to stagger with each axis's width);
 *   - the latest value is printed large at the top-right of every panel;
 *   - rate stats format the baseball way (.312, not 0.312), percentages
 *     carry their sign, velocity keeps one decimal;
 *   - one accent hue for every row — each panel is a single series;
 *   - a velocity row never stretches a 0.7-mph wobble to full height: its
 *     domain is at least ±2 mph around the mean.
 */

export type MetricUnit = 'rate' | 'pct' | 'mph' | 'plain';

export interface RollingMetric {
  key: string;
  unit: MetricUnit;
}

const RATE_KEYS = new Set(['AVG', 'OBP', 'SLG', 'OPS', 'wOBA', 'xwOBA', 'ISO', 'BABIP', 'xwOBAcon']);

/** Infer the unit from the metric name and a sample raw string ("95.2 mph", "35.7%"). */
export function metricUnit(key: string, sample: unknown): MetricUnit {
  const s = sample == null ? '' : String(sample);
  if (/mph/i.test(s) || /velo/i.test(key)) return 'mph';
  if (/%/.test(s) || /%/.test(key)) return 'pct';
  if (RATE_KEYS.has(key)) return 'rate';
  return 'plain';
}

export function formatMetric(value: number, unit: MetricUnit): string {
  switch (unit) {
    case 'rate':
      return formatRate(value);
    case 'pct':
      return `${value.toFixed(1)}%`;
    case 'mph':
      return value.toFixed(1);
    default:
      return Number.isInteger(value) ? String(value) : value.toFixed(1);
  }
}

/** Vega expression for a panel's axis tick labels, by unit. */
function axisLabelExpr(unit: MetricUnit): string {
  switch (unit) {
    case 'rate':
      return "replace(format(datum.value, '.3f'), /^(-?)0\\./, '$1.')";
    case 'pct':
      return "format(datum.value, '.0f') + '%'";
    case 'mph':
      return "format(datum.value, '.0f')";
    default:
      return "format(datum.value, '~g')";
  }
}

/** Minimum half-range for a velocity panel, in mph. */
export const VELO_HALF_BAND = 2;

export interface RollingSpecInput {
  tidy: TidyRow[];
  metrics: RollingMetric[];
  options: ResolvedVizOptions;
  /** "15-game windows" / "5-start windows" */
  windowLabel: string;
  /** "May 01–Jul 17" style span for the subtitle, or undefined when unknown. */
  span?: string;
}

export function buildRollingSpec(input: RollingSpecInput) {
  const { tidy, metrics, options, windowLabel, span } = input;
  const t = THEMES[options.theme];
  const d = AUDIENCE_DEFAULTS[options.audience];
  const unitOf = new Map(metrics.map((m) => [m.key, m.unit]));
  const metricOrder = metrics.map((m) => m.key);

  const segmented = assignGapSegments(tidy);
  const byMetric = new Map<string, typeof segmented>();
  for (const r of segmented) {
    const arr = byMetric.get(r.metric) ?? [];
    arr.push(r);
    byMetric.set(r.metric, arr);
  }

  // One panel per metric, stacked with `vconcat` rather than a row facet:
  // each panel then owns its axis format (a facet's tick labels can't see
  // which row they belong to) and can pin its own headline value.
  const headerHeight = d.axisTitleFontSize + 8;
  const panelHeight = Math.max(64, Math.floor(options.height / metricOrder.length) - headerHeight - 10);
  const gutter = Math.round(d.axisLabelFontSize * 3.4);
  const accent = t.accent;
  const xDomain = (() => {
    const times = tidy.map((r) => Date.parse(r.window_end)).filter(Number.isFinite);
    if (times.length === 0) return undefined;
    const pad = 2 * 86_400_000;
    return [new Date(Math.min(...times) - pad).toISOString(), new Date(Math.max(...times) + pad).toISOString()];
  })();

  const panels = metricOrder.map((metric, i) => {
    const unit = unitOf.get(metric) ?? 'plain';
    const pts = (byMetric.get(metric) ?? []).slice().sort((a, b) => Date.parse(a.window_end) - Date.parse(b.window_end));
    const last = pts[pts.length - 1];
    const mean = pts.length > 0 ? pts.reduce((a, p) => a + p.value, 0) / pts.length : 0;
    const isLast = i === metricOrder.length - 1;
    // A velocity panel's domain is at least ±VELO_HALF_BAND around its mean
    // so a 0.7-mph wobble never fills the panel.
    const band = unit === 'mph' ? [{ lo: mean - VELO_HALF_BAND, hi: mean + VELO_HALF_BAND }] : [];

    return {
      title: {
        text: metric,
        anchor: 'start',
        fontSize: d.axisTitleFontSize,
        fontWeight: 'bold',
        color: t.ink,
        offset: 6,
        dx: gutter,
      },
      width: options.width - gutter,
      height: panelHeight,
      layer: [
        {
          data: { values: band },
          mark: { type: 'rule', opacity: 0 },
          encoding: { y: { field: 'lo', type: 'quantitative' }, y2: { field: 'hi' } },
        },
        {
          data: { values: [{ mean }] },
          mark: { type: 'rule', strokeDash: [4, 4], stroke: t.muted, opacity: 0.6 },
          encoding: { y: { field: 'mean', type: 'quantitative' } },
        },
        {
          data: { values: pts },
          mark: { type: 'line', strokeWidth: 2, strokeCap: 'round', strokeJoin: 'round', color: accent },
          encoding: {
            x: {
              field: 'window_end',
              type: 'temporal',
              scale: xDomain ? { domain: xDomain } : {},
              axis: isLast
                ? { title: null, format: '%b %d', tickCount: 5, grid: false, domain: false, labelFlush: true }
                : null,
            },
            y: {
              field: 'value',
              type: 'quantitative',
              axis: { title: null, tickCount: 3, labelExpr: axisLabelExpr(unit), domain: false, ticks: false, minExtent: gutter, maxExtent: gutter },
              scale: { zero: false, nice: unit === 'mph' ? false : true, padding: 6 },
            },
            // Break the line across long absences (see rolling-segments.ts).
            detail: { field: 'segment', type: 'nominal' },
          },
        },
        {
          data: { values: pts },
          mark: { type: 'point', filled: true, size: Math.max(36, d.axisLabelFontSize * 4), color: accent, stroke: t.surface, strokeWidth: 1.5, opacity: 1 },
          encoding: {
            x: { field: 'window_end', type: 'temporal' },
            y: { field: 'value', type: 'quantitative' },
            tooltip: [
              { field: 'window_end', type: 'temporal', format: '%Y-%m-%d', title: 'Window end' },
              { field: 'value', title: metric, format: '.3f' },
            ],
          },
        },
        ...(last
          ? [{
              // Latest value, headline size, at the panel's top-right.
              data: { values: [{ label: formatMetric(last.value, unit) }] },
              mark: {
                type: 'text',
                align: 'right',
                baseline: 'bottom',
                x: { expr: 'width' },
                y: { expr: `-${headerHeight + 4}` },
                fontSize: Math.round(d.titleFontSize * 1.1),
                fontWeight: 'bold',
                color: t.ink,
              },
              encoding: { text: { field: 'label', type: 'nominal' } },
            }]
          : []),
      ],
    };
  });

  return {
    $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
    title: {
      text: options.title,
      subtitle: [windowLabel, span, 'dashed = mean of shown windows'].filter(Boolean).join(' · '),
    },
    spacing: 10,
    vconcat: panels,
    resolve: { scale: { x: 'shared', y: 'independent' }, axis: { y: 'independent' } },
    config: audienceConfig(options.audience, { colorblind: options.colorblind, theme: options.theme }),
  };
}

/** Parse numeric values out of strings like "0.312", "95.2 mph", "35.7%" */
export function parseNumeric(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).replace(/[^\d.-]/g, '');
  if (!s) return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

export function isParseableDate(v: unknown): boolean {
  if (v == null || v === '') return false;
  const s = String(v);
  // Guard against pure numbers (e.g., '1', '15' are technically parseable
  // as year-only but not what we want) — require at least YYYY-MM or MM/DD.
  if (!/[-/]/.test(s)) return false;
  const t = Date.parse(s);
  return Number.isFinite(t);
}

export interface PivotResult {
  tidy: TidyRow[];
  metrics: RollingMetric[];
  /** Window size parsed from the first row's `Window` column when it names one. */
  windowSize?: number;
  span?: string;
}

/**
 * Pivot wide window rows to tidy metric/value pairs. `excluded` names the
 * denominator column (Games / Starts) that isn't a performance metric.
 */
export function pivotRollingRows(
  wideRows: Record<string, unknown>[],
  excluded: string[],
): PivotResult {
  const preferredKeys = ['Window End', 'window_end', 'Date', 'date', 'End Date'];
  let dateKey: string | null = null;
  if (wideRows.length > 0) {
    const first = wideRows[0]!;
    for (const k of preferredKeys) {
      if (k in first && isParseableDate(first[k])) {
        dateKey = k;
        break;
      }
    }
  }
  const skip = new Set<string>([...(dateKey ? [dateKey] : []), 'Window', ...excluded]);
  const metricKeys: string[] = [];
  const sample = new Map<string, unknown>();
  for (const r of wideRows) {
    for (const k of Object.keys(r)) {
      if (skip.has(k) || metricKeys.includes(k)) continue;
      if (parseNumeric(r[k]) != null) {
        metricKeys.push(k);
        sample.set(k, r[k]);
      }
    }
  }
  const tidy: TidyRow[] = [];
  for (const r of wideRows) {
    const date = dateKey ? String(r[dateKey] ?? '') : '';
    if (!date || !isParseableDate(date)) continue;
    for (const k of metricKeys) {
      const n = parseNumeric(r[k]);
      if (n != null) tidy.push({ window_end: date, metric: k, value: n });
    }
  }
  const metrics = metricKeys.map((key) => ({ key, unit: metricUnit(key, sample.get(key)) }));

  // "2026-05-01 → 2026-05-17" style Window strings carry the span; the
  // window size comes from the Games/Starts column of the first row.
  const first = wideRows[0];
  const sizeCol = excluded.find((c) => first && parseNumeric(first[c]) != null);
  const windowSize = sizeCol && first ? (parseNumeric(first[sizeCol]) ?? undefined) : undefined;
  const dates = tidy.map((r) => r.window_end).sort();
  const span = dates.length > 0 ? `${fmtDay(dates[0]!)}–${fmtDay(dates[dates.length - 1]!)}` : undefined;
  return { tidy, metrics, windowSize, span };
}

function fmtDay(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', timeZone: 'UTC' });
}
