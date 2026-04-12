import { registerTemplate, type QueryTemplate } from './registry.js';
import type { PlayerStats } from '../../adapters/types.js';

/**
 * Pitcher Season Profile (FanGraphs)
 *
 * Aggregated season-level stats pulled from the FanGraphs leaderboard
 * API. Used by the `pro-pitcher-eval` report's Performance Profile
 * section (BBDATA-003).
 *
 * Unlike the pitch-level Savant templates, this template expects
 * `PlayerStats[]` — one row per player — and reads specific leaderboard
 * columns from the `stats` dict. Returns a `Metric | Value` shape
 * (mirroring `hitter-batted-ball`'s output) so the Handlebars template
 * can render a simple two-column table.
 *
 * Output rows are ordered for the typical pro eval reading order:
 * traditional stats (W-L, ERA, IP, GS) first, then DIPS (FIP, xFIP,
 * SIERA), then plate discipline (K-BB%), then WAR for the summary.
 */

interface MetricSpec {
  label: string;
  /** FanGraphs leaderboard column keys to try in order. */
  keys: string[];
  /** Formatter for the raw value. */
  format: (v: number | string | null) => string;
}

const fmtFixed = (n: number) => (v: number | string | null) =>
  v == null || v === '' ? '—' : Number(v).toFixed(n);
const fmtPercent = (v: number | string | null) =>
  v == null || v === '' ? '—' : `${Number(v).toFixed(1)}%`;
const fmtRaw = (v: number | string | null) =>
  v == null || v === '' ? '—' : String(v);
const fmtInt = (v: number | string | null) =>
  v == null || v === '' ? '—' : String(Math.round(Number(v)));

const METRICS: MetricSpec[] = [
  { label: 'W-L', keys: ['W-L'], format: fmtRaw },
  { label: 'ERA', keys: ['ERA'], format: fmtFixed(2) },
  { label: 'IP', keys: ['IP'], format: fmtFixed(1) },
  { label: 'GS', keys: ['GS', 'G'], format: fmtInt },
  { label: 'FIP', keys: ['FIP'], format: fmtFixed(2) },
  { label: 'xFIP', keys: ['xFIP'], format: fmtFixed(2) },
  { label: 'SIERA', keys: ['SIERA'], format: fmtFixed(2) },
  { label: 'K-BB%', keys: ['K-BB%', 'K_BB_pct'], format: fmtPercent },
  { label: 'WAR', keys: ['WAR'], format: fmtFixed(1) },
];

const template: QueryTemplate = {
  id: 'pitcher-season-profile',
  name: 'Pitcher Season Profile',
  category: 'pitcher',
  description: 'FanGraphs season stats (ERA, FIP, xFIP, SIERA, K-BB%, WAR) as a Metric/Value table',
  preferredSources: ['fangraphs'],
  requiredParams: ['player'],
  optionalParams: ['season'],
  examples: [
    'bbdata query pitcher-season-profile --player "Corbin Burnes" --season 2024',
  ],

  buildQuery(params) {
    return {
      player_name: params.player,
      season: params.season ?? new Date().getFullYear(),
      stat_type: 'pitching',
    };
  },

  columns() {
    return ['Metric', 'Value'];
  },

  transform(data) {
    const rows = data as PlayerStats[];
    if (rows.length === 0) return [];

    // FanGraphs adapter already filters by player_name when provided,
    // so the first row is our target. If multiple (split by team during
    // midseason trade), FanGraphs typically aggregates them into a
    // "- - -" team row; take the first.
    const first = rows[0];
    if (!first) return [];
    const stats = first.stats ?? {};

    // Special case: construct W-L from separate W and L columns if the
    // adapter didn't provide a combined "W-L" key.
    let wlValue: string | null = null;
    if ('W-L' in stats && stats['W-L'] != null) {
      wlValue = String(stats['W-L']);
    } else if (stats.W != null && stats.L != null) {
      wlValue = `${stats.W}-${stats.L}`;
    }

    return METRICS.map((m) => {
      if (m.label === 'W-L' && wlValue != null) {
        return { Metric: m.label, Value: wlValue };
      }
      let raw: number | string | null = null;
      for (const key of m.keys) {
        if (key in stats && stats[key] != null) {
          raw = stats[key] as number | string;
          break;
        }
      }
      return { Metric: m.label, Value: m.format(raw) };
    });
  },
};

registerTemplate(template);
