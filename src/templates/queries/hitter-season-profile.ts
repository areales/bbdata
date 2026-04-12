import { registerTemplate, type QueryTemplate } from './registry.js';
import type { PlayerStats } from '../../adapters/types.js';

/**
 * Hitter Season Profile (FanGraphs)
 *
 * Aggregated season-level stats pulled from the FanGraphs leaderboard
 * API. Used by the `pro-hitter-eval` report's Performance Profile
 * section (BBDATA-004). Parallel to `pitcher-season-profile`.
 *
 * Outputs a `Metric | Value` shape so the Handlebars template can
 * render a simple two-column table. Rows are ordered for a GM reader:
 * slash line → advanced hitting (wOBA, wRC+) → power (ISO, HR) → plate
 * discipline (BB%, K%) → production (WAR, SB).
 */

interface MetricSpec {
  label: string;
  keys: string[];
  format: (v: number | string | null) => string;
}

const fmtFixed = (n: number) => (v: number | string | null) =>
  v == null || v === '' ? '—' : Number(v).toFixed(n);
const fmtPercent = (v: number | string | null) =>
  v == null || v === '' ? '—' : `${Number(v).toFixed(1)}%`;
const fmtInt = (v: number | string | null) =>
  v == null || v === '' ? '—' : String(Math.round(Number(v)));

const METRICS: MetricSpec[] = [
  { label: 'AVG', keys: ['AVG'], format: fmtFixed(3) },
  { label: 'OBP', keys: ['OBP'], format: fmtFixed(3) },
  { label: 'SLG', keys: ['SLG'], format: fmtFixed(3) },
  { label: 'wOBA', keys: ['wOBA'], format: fmtFixed(3) },
  { label: 'wRC+', keys: ['wRC+', 'wRCplus'], format: fmtInt },
  { label: 'ISO', keys: ['ISO'], format: fmtFixed(3) },
  { label: 'HR', keys: ['HR'], format: fmtInt },
  { label: 'BB%', keys: ['BB%', 'BB_pct'], format: fmtPercent },
  { label: 'K%', keys: ['K%', 'K_pct'], format: fmtPercent },
  { label: 'WAR', keys: ['WAR'], format: fmtFixed(1) },
];

const template: QueryTemplate = {
  id: 'hitter-season-profile',
  name: 'Hitter Season Profile',
  category: 'hitter',
  description: 'FanGraphs season stats (AVG/OBP/SLG, wOBA, wRC+, WAR) as a Metric/Value table',
  preferredSources: ['fangraphs'],
  requiredParams: ['player'],
  optionalParams: ['season'],
  examples: [
    'bbdata query hitter-season-profile --player "Aaron Judge" --season 2024',
  ],

  buildQuery(params) {
    return {
      player_name: params.player,
      season: params.season ?? new Date().getFullYear(),
      stat_type: 'batting',
    };
  },

  columns() {
    return ['Metric', 'Value'];
  },

  transform(data) {
    const rows = data as PlayerStats[];
    if (rows.length === 0) return [];
    const first = rows[0];
    if (!first) return [];
    const stats = first.stats ?? {};

    return METRICS.map((m) => {
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
