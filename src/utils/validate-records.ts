/**
 * Fail-fast guard for template `transform()` inputs.
 *
 * Real-world adapter output (Savant CSV, MLB Stats API JSON, FanGraphs
 * leaderboard) always includes every field the templates dereference.
 * Hand-authored stdin / `--data` fixtures sometimes don't. Before this
 * helper, missing fields surfaced as `TypeError: Cannot read properties
 * of undefined (reading 'includes')` — a stack trace that pointed at
 * the template instead of the input.
 *
 * Checks only the first record (payloads are homogeneous in practice)
 * and reports every missing field in one message so the user can fix
 * the whole payload in one edit, not bisect one field at a time.
 */
export function assertFields(
  records: unknown[],
  requiredFields: string[],
  templateId: string,
): void {
  if (records.length === 0) return;
  const first = records[0] as Record<string, unknown>;
  const missing = requiredFields.filter((f) => first[f] === undefined);
  if (missing.length === 0) return;
  const quoted = (fs: string[]) => fs.map((f) => `"${f}"`).join(', ');
  const plural = missing.length > 1 ? 's' : '';
  throw new Error(
    `Record missing field${plural} ${quoted(missing)} — ` +
      `"${templateId}" template requires ${quoted(requiredFields)}. ` +
      `See src/adapters/types.ts for the full PitchData / PlayerStats schema, ` +
      `or confirm your stdin / --data payload is a complete Savant export.`,
  );
}
