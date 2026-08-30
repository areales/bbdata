import { registerTemplate, type QueryTemplate } from './registry.js';
import { assertFields } from '../../utils/validate-records.js';
import type { PlayerStats } from '../../adapters/types.js';
import { fmtFixed, fmtInt, fmtPercent } from '../../utils/stat-format.js';


const REQUIRED_FIELDS = ['player_name'];

/**
 * Key batting metrics to compare. Lookup is by exact case-insensitive
 * key match against the listed variants — never by stripping `%`/`+`
 * symbols, which collides distinct stats: `BB%` normalized to `bb`
 * matched FanGraphs' raw `BB` walk-count column (P1.10), and `wRC+`
 * normalized to `wrc` matched `wRC`, weighted runs created (P1.17).
 */
const METRICS: {
  label: string;
  keys: string[];
  format: (v: number | string | null) => string;
}[] = [
  { label: 'AVG', keys: ['AVG'], format: fmtFixed(3) },
  { label: 'OBP', keys: ['OBP'], format: fmtFixed(3) },
  { label: 'SLG', keys: ['SLG'], format: fmtFixed(3) },
  { label: 'OPS', keys: ['OPS'], format: fmtFixed(3) },
  { label: 'wRC+', keys: ['wRC+', 'wRCplus'], format: fmtInt },
  { label: 'WAR', keys: ['WAR'], format: fmtFixed(1) },
  { label: 'HR', keys: ['HR', 'homeRuns'], format: fmtInt },
  { label: 'RBI', keys: ['RBI'], format: fmtInt },
  { label: 'K%', keys: ['K%', 'K_pct'], format: fmtPercent },
  { label: 'BB%', keys: ['BB%', 'BB_pct'], format: fmtPercent },
  { label: 'ISO', keys: ['ISO'], format: fmtFixed(3) },
  { label: 'BABIP', keys: ['BABIP'], format: fmtFixed(3) },
];

const template: QueryTemplate = {
  id: 'leaderboard-comparison',
  name: 'Player Comparison',
  category: 'leaderboard',
  description: 'Side-by-side comparison of multiple players across key metrics vs league average',
  preferredSources: ['fangraphs', 'mlb-stats-api'],
  requiredParams: ['players'],
  optionalParams: ['season'],
  examples: [
    'bbdata query leaderboard-comparison --players "Aaron Judge,Juan Soto,Mookie Betts"',
  ],

  buildQuery(params) {
    return {
      season: params.season ?? new Date().getFullYear(),
      stat_type: 'batting',
    };
  },

  columns(params) {
    return ['Metric', ...(params.players ?? [])];
  },

  transform(data, params) {
    const allStats = data as PlayerStats[];
    if (allStats.length === 0) return [];
    assertFields(allStats, REQUIRED_FIELDS, 'leaderboard-comparison');
    
    const playerNames = params.players ?? [];

    // Match players by name (case-insensitive partial match)
    const matched = playerNames.map((name) => {
      const norm = name.toLowerCase();
      return allStats.find((s) => s.player_name.toLowerCase().includes(norm));
    });

    return METRICS.map((metric) => {
      const row: Record<string, unknown> = { Metric: metric.label };
      for (let i = 0; i < playerNames.length; i++) {
        const player = matched[i];
        if (!player) {
          row[playerNames[i]] = '—';
          continue;
        }
        row[playerNames[i]] = metric.format(findStatValue(player.stats, metric.keys));
      }
      return row;
    });
  },
};

function findStatValue(
  stats: Record<string, unknown>,
  keys: string[],
): number | string | null {
  for (const key of keys) {
    const lower = key.toLowerCase();
    for (const [k, v] of Object.entries(stats)) {
      if (k.toLowerCase() === lower && v != null) {
        return v as number | string;
      }
    }
  }
  return null;
}

registerTemplate(template);
