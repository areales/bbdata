/**
 * Null-aware numeric aggregation for template transforms.
 *
 * Statcast tracking fields are nullable (P1.11) — a dropout must be
 * excluded from the denominator, not averaged in as a fabricated 0
 * that drags the mean toward zero.
 */

/** Mean of the non-null values; null when nothing was measured. */
export function meanOf(values: (number | null | undefined)[]): number | null {
  const nums = values.filter((v): v is number => v != null);
  return nums.length > 0 ? nums.reduce((s, v) => s + v, 0) / nums.length : null;
}
