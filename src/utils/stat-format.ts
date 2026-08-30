/**
 * Shared metric-value formatters for query templates.
 *
 * Hoisted from per-template copies (P1.4/P1.5): duplicated `fmtPercent`
 * definitions in pitcher-season-profile and hitter-season-profile both
 * multiplied nothing and rendered FanGraphs rate ratios (0.186) as
 * "0.2%". Keep a single definition here so a third template can't
 * re-introduce the divergence.
 */

/**
 * Format a rate stat as a percentage string.
 *
 * FanGraphs returns rate stats (K%, BB%, K-BB%) as ratios (0.186 =
 * 18.6%), but other sources and hand-authored stdin payloads may carry
 * them already scaled (18.6). Values with |v| <= 1 are treated as
 * ratios and scaled by 100; anything larger passes through unscaled.
 */
export const fmtPercent = (v: number | string | null): string => {
  if (v == null || v === '') return '—';
  const n = Number(v);
  if (Number.isNaN(n)) return '—';
  const scaled = Math.abs(n) <= 1 ? n * 100 : n;
  return `${scaled.toFixed(1)}%`;
};

/** Format a stat with a fixed number of decimal places. */
export const fmtFixed = (decimals: number) => (v: number | string | null): string => {
  if (v == null || v === '') return '—';
  const n = Number(v);
  return Number.isNaN(n) ? '—' : n.toFixed(decimals);
};

/** Format a stat as a rounded integer. */
export const fmtInt = (v: number | string | null): string => {
  if (v == null || v === '') return '—';
  const n = Number(v);
  return Number.isNaN(n) ? '—' : String(Math.round(n));
};
