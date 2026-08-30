import { registerTemplate, type QueryTemplate, type QueryTemplateParams } from './registry.js';
import type { PlayerStats } from '../../adapters/types.js';
import { fmtFixed, fmtInt, fmtPercent } from '../../utils/stat-format.js';
import { assertFields } from '../../utils/validate-records.js';

/**
 * Year-over-year comparison (P1.9). Fetches a two-season range through
 * the FanGraphs adapter's `start_season` support (one row per
 * player-season) and compares the two most recent seasons present.
 *
 * Stat lookup uses explicit key variants per metric — never symbol
 * stripping, which collided `wRC+` with `wRC` and `BB%` with the raw
 * `BB` count column (the P1.10/P1.17 defect class).
 */

interface MetricSpec {
  label: string;
  keys: string[];
  format: (v: number | string | null) => string;
}

const BATTING_METRICS: MetricSpec[] = [
  { label: 'AVG', keys: ['AVG'], format: fmtFixed(3) },
  { label: 'OBP', keys: ['OBP'], format: fmtFixed(3) },
  { label: 'SLG', keys: ['SLG'], format: fmtFixed(3) },
  { label: 'HR', keys: ['HR'], format: fmtInt },
  { label: 'wRC+', keys: ['wRC+', 'wRCplus'], format: fmtInt },
  { label: 'K%', keys: ['K%', 'K_pct'], format: fmtPercent },
  { label: 'BB%', keys: ['BB%', 'BB_pct'], format: fmtPercent },
  { label: 'WAR', keys: ['WAR'], format: fmtFixed(1) },
  { label: 'ISO', keys: ['ISO'], format: fmtFixed(3) },
  { label: 'BABIP', keys: ['BABIP'], format: fmtFixed(3) },
];

const PITCHING_METRICS: MetricSpec[] = [
  { label: 'ERA', keys: ['ERA'], format: fmtFixed(2) },
  { label: 'FIP', keys: ['FIP'], format: fmtFixed(2) },
  { label: 'xFIP', keys: ['xFIP'], format: fmtFixed(2) },
  { label: 'WHIP', keys: ['WHIP'], format: fmtFixed(2) },
  { label: 'K%', keys: ['K%', 'K_pct'], format: fmtPercent },
  { label: 'BB%', keys: ['BB%', 'BB_pct'], format: fmtPercent },
  { label: 'K-BB%', keys: ['K-BB%', 'K_BB_pct'], format: fmtPercent },
  { label: 'IP', keys: ['IP'], format: fmtFixed(1) },
  { label: 'WAR', keys: ['WAR'], format: fmtFixed(1) },
];

/** Parse `--seasons` ("2024-2025" or "2025") into a [start, end] pair. */
function parseSeasons(params: QueryTemplateParams): { start: number; end: number } {
  const raw = params.seasons?.trim();
  if (!raw) {
    const end = params.season ?? new Date().getFullYear();
    return { start: end - 1, end };
  }
  const range = raw.match(/^(\d{4})\s*-\s*(\d{4})$/);
  if (range) {
    const start = Number(range[1]);
    const end = Number(range[2]);
    if (start >= end) {
      throw new Error(`--seasons range "${raw}" must run earlier→later, e.g. 2024-2025`);
    }
    return { start, end };
  }
  const single = raw.match(/^(\d{4})$/);
  if (single) {
    const end = Number(single[1]);
    return { start: end - 1, end };
  }
  throw new Error(`Invalid --seasons "${raw}". Use a range like 2024-2025 or a single year.`);
}

function findStatValue(
  stats: Record<string, unknown>,
  keys: string[],
): number | null {
  for (const key of keys) {
    const lower = key.toLowerCase();
    for (const [k, v] of Object.entries(stats)) {
      if (k.toLowerCase() === lower && v != null) {
        const n = Number(v);
        return Number.isNaN(n) ? null : n;
      }
    }
  }
  return null;
}

const template: QueryTemplate = {
  id: 'trend-year-over-year',
  name: 'Year-over-Year Comparison',
  category: 'trend',
  description: 'Compare metric changes year to year — flags changes greater than 10%',
  preferredSources: ['fangraphs', 'mlb-stats-api'],
  requiredParams: ['player'],
  optionalParams: ['seasons', 'stat'], // e.g. --seasons "2023-2025", --stat pitching
  examples: [
    'bbdata query trend-year-over-year --player "Julio Rodriguez" --seasons 2023-2025',
    'bbdata query trend-year-over-year --player "Corbin Burnes" --seasons 2024-2025 --stat pitching',
  ],

  buildQuery(params) {
    const { start, end } = parseSeasons(params);
    const stat = params.stat?.toLowerCase();
    if (stat != null && stat !== 'batting' && stat !== 'pitching') {
      throw new Error(
        `Invalid --stat "${params.stat}" for trend-year-over-year. Expected "batting" (default) or "pitching".`,
      );
    }
    return {
      player_name: params.player,
      season: end,
      start_season: start,
      stat_type: stat === 'pitching' ? 'pitching' : 'batting',
    };
  },

  columns() {
    return ['Metric', 'Prior', 'Current', 'Change', 'Flag'];
  },

  transform(data, params) {
    const rows = data as PlayerStats[];
    if (rows.length === 0) return [];
    assertFields(rows, ['season', 'stats'], 'trend-year-over-year');

    const { end } = parseSeasons(params);

    // One row per player-season from the FanGraphs range fetch. Compare
    // the two most recent seasons present, at or before the range end
    // (an adapter without start_season support returns one season and
    // the Prior column degrades to —).
    const bySeason = new Map<number, PlayerStats>();
    for (const row of rows) {
      if (row.season <= end && !bySeason.has(row.season)) {
        bySeason.set(row.season, row);
      }
    }
    const seasons = Array.from(bySeason.keys()).sort((a, b) => b - a);
    const current = bySeason.get(seasons[0])!;
    const prior = seasons.length > 1 ? bySeason.get(seasons[1]) : undefined;

    // FanGraphs' qual=0 batting leaderboard includes pitchers as all-zero
    // batting lines — a table of 0.000s is worse than an error. Detect
    // via PA and point at the pitching mode instead.
    if (current.stat_type === 'batting') {
      // Only an explicit PA/AB of 0 marks a pitcher's empty batting line —
      // a payload without the field at all (sparse stdin fixtures, other
      // adapters) proceeds and renders whatever metrics it carries.
      const noPa = Array.from(bySeason.values()).every(
        (row) => findStatValue(row.stats, ['PA', 'AB']) === 0,
      );
      if (noPa) {
        throw new Error(
          `No batting data for "${current.player_name}" in the requested seasons — ` +
            `if they're a pitcher, re-run with --stat pitching.`,
        );
      }
    }

    const metrics = current.stat_type === 'pitching' ? PITCHING_METRICS : BATTING_METRICS;

    return metrics.map((m) => {
      const currVal = findStatValue(current.stats, m.keys);
      const priorVal = prior ? findStatValue(prior.stats, m.keys) : null;

      let change = '—';
      let flag = '';
      if (currVal != null && priorVal != null) {
        const delta = currVal - priorVal;
        const sign = delta > 0 ? '+' : '';
        change = `${sign}${m.format(delta)}`;
        if (priorVal !== 0 && Math.abs(delta / priorVal) > 0.1) {
          flag = '⚠';
        }
      }

      return {
        Metric: m.label,
        Prior: priorVal != null ? m.format(priorVal) : '—',
        Current: currVal != null ? m.format(currVal) : '—',
        Change: change,
        Flag: flag,
      };
    });
  },
};

registerTemplate(template);
