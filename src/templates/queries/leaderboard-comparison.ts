import { registerTemplate, type QueryTemplate } from './registry.js';
import { assertFields } from '../../utils/validate-records.js';
import type { PlayerStats } from '../../adapters/types.js';
import { fmtPercent } from '../../utils/format.js';


const REQUIRED_FIELDS = ['player_name'];

// Rate metrics render through the shared fmtPercent so this template
// agrees with the season profiles' representation ("18.5%", not "0.185")
// for the same player-season. The systemic per-column design is P1.6.
const RATE_METRICS = new Set(['K%', 'BB%']);

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

    // Key batting metrics to compare
    const metrics = [
      'AVG', 'OBP', 'SLG', 'OPS', 'wRC+', 'WAR', 'HR', 'RBI',
      'K%', 'BB%', 'ISO', 'BABIP',
    ];

    return metrics.map((metric) => {
      const row: Record<string, unknown> = { Metric: metric };
      for (let i = 0; i < playerNames.length; i++) {
        const player = matched[i];
        if (!player) {
          row[playerNames[i]] = '—';
          continue;
        }
        const val = findStatValue(player.stats, metric);
        row[playerNames[i]] =
          val == null ? '—' : RATE_METRICS.has(metric) ? fmtPercent(val) : val;
      }
      return row;
    });
  },
};

function findStatValue(stats: Record<string, unknown>, key: string): string | null {
  // Exact key first: FanGraphs rows carry both counting and rate forms
  // whose names collide once +/% are stripped (BB vs BB%, wRC vs wRC+),
  // and the normalized scan below returns whichever iterates first — a
  // walk *total* under the BB% label (P1.10) and wRC under wRC+ (P1.17).
  if (key in stats) return formatStatValue(stats[key]);
  const lower = key.toLowerCase().replace(/[+%]/g, '');
  for (const [k, v] of Object.entries(stats)) {
    if (k.toLowerCase().replace(/[+%]/g, '') === lower) {
      return formatStatValue(v);
    }
  }
  return null;
}

function formatStatValue(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  if (isNaN(n)) return String(v);
  return n < 1 && n > 0 ? n.toFixed(3) : n % 1 === 0 ? String(n) : n.toFixed(1);
}

registerTemplate(template);
