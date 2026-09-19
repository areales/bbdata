/**
 * Shared gap-break logic for the rolling chart family.
 *
 * Rolling windows are counted in games (or starts), not days, so a hitter
 * who sits out three months produces one window that spans the whole
 * absence. Drawn as a single line, that window reads as a slow slide when
 * it is really two separate stretches of play. This tags each tidy row with
 * a `segment` index that increments whenever consecutive window ends are
 * more than `maxGapDays` apart; the line mark encodes it as `detail` so the
 * line breaks at the gap while color still follows the metric.
 *
 * Normal spacing is one window per game (~1–2 days) for hitters and one per
 * start (~5–6 days) for pitchers, so 21 days clears the All-Star break and
 * any ordinary rest without hiding an IL stint.
 */
export const DEFAULT_MAX_GAP_DAYS = 21;

export type TidyRow = { window_end: string; metric: string; value: number };
export type SegmentedRow = TidyRow & { segment: number };

const MS_PER_DAY = 86_400_000;

export function assignGapSegments(
  tidy: TidyRow[],
  maxGapDays: number = DEFAULT_MAX_GAP_DAYS,
): SegmentedRow[] {
  const dates = Array.from(new Set(tidy.map((r) => r.window_end))).sort(
    (a, b) => Date.parse(a) - Date.parse(b),
  );
  const segmentByDate = new Map<string, number>();
  let segment = 0;
  for (let i = 0; i < dates.length; i++) {
    if (i > 0) {
      const gapDays = (Date.parse(dates[i]) - Date.parse(dates[i - 1])) / MS_PER_DAY;
      if (gapDays > maxGapDays) segment++;
    }
    segmentByDate.set(dates[i], segment);
  }
  return tidy.map((r) => ({ ...r, segment: segmentByDate.get(r.window_end) ?? 0 }));
}
