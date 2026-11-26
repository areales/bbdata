import { log } from './logger.js';

/**
 * The date on which an omitted `--season` starts meaning the current calendar
 * year. Before it, the default is the previous year.
 *
 * This is a calendar heuristic, not a schedule lookup. Opening Day has landed
 * in late March in every full season since 2018, so April 1 is the first date
 * by which the regular season has normally started. A fixed date keeps the
 * default deterministic, adds no network call to every command, and works
 * offline with `--stdin` and `--data`. The cost is the few days between
 * Opening Day and April 1, when the default is still the previous, complete
 * season — a default that returns data, with a notice saying how to get the
 * new one. It does not guarantee rows: a season that starts late, or a player
 * with no appearances yet, still needs an explicit `--season`.
 */
export const SEASON_CUTOVER = { month: 4, day: 1 } as const;

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

const CUTOVER_LABEL = `${MONTH_NAMES[SEASON_CUTOVER.month - 1]} ${SEASON_CUTOVER.day}`;

/**
 * The season an omitted `--season` resolves to: the calendar year on or after
 * the cutover date, the previous year before it. Reads the local date, the
 * same clock a user reads off their own calendar.
 */
export function defaultSeason(now: Date = new Date()): number {
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const reachedCutover =
    month > SEASON_CUTOVER.month ||
    (month === SEASON_CUTOVER.month && now.getDate() >= SEASON_CUTOVER.day);
  return reachedCutover ? year : year - 1;
}

export interface ResolveSeasonOptions {
  /** Injected clock, for tests. */
  now?: Date;
  /**
   * Suppress the fallback notice. Set when something else the user passed
   * decides the season (e.g. `--seasons 2023-2025`), so the notice would
   * name a year the command isn't going to fetch.
   */
  quiet?: boolean;
}

/**
 * Resolve the season a command runs against. An explicit season is returned
 * untouched. An omitted one becomes `defaultSeason()`, and when that is not
 * the calendar year, one notice goes to stderr naming the season used —
 * stdout stays parseable.
 */
export function resolveSeason(
  explicit: number | undefined,
  options: ResolveSeasonOptions = {},
): number {
  if (explicit != null) return explicit;

  const now = options.now ?? new Date();
  const season = defaultSeason(now);
  const calendarYear = now.getFullYear();
  if (season !== calendarYear && !options.quiet) {
    log.warn(
      `No --season given: using ${season}, because the ${calendarYear} season hasn't reached ` +
        `the ${CUTOVER_LABEL} cutover. Pass --season ${calendarYear} to override.`,
    );
  }
  return season;
}

/** `--help` text for `-s, --season`, shared by query, report, and viz. */
export function seasonOptionDescription(now: Date = new Date()): string {
  return (
    `Season year (default: ${defaultSeason(now)}; the current year from ` +
    `${CUTOVER_LABEL}, the previous year before that)`
  );
}
