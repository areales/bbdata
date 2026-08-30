/**
 * Shared value formatters for query-template transforms.
 */

/**
 * Format a rate stat as a percentage string.
 *
 * FanGraphs represents rate stats as ratios (`0.186` for 18.6%), but
 * some sources and fixtures carry them already scaled (`18.6`). Values
 * with an absolute value of 1 or less are treated as ratios and scaled
 * by 100, so the output is correct under either representation.
 */
export const fmtPercent = (v: number | string | null): string => {
  if (v == null || v === '') return '—';
  const n = Number(v);
  const scaled = Math.abs(n) <= 1 ? n * 100 : n;
  return `${scaled.toFixed(1)}%`;
};
