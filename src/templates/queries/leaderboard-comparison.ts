import { registerTemplate, type QueryTemplate } from './registry.js';
import type { PlayerStats } from '../../adapters/types.js';

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
        row[playerNames[i]] = val ?? '—';
      }
      return row;
    });
  },
};

function findStatValue(stats: Record<string, unknown>, key: string): string | null {
  const lower = key.toLowerCase().replace(/[+%]/g, '');
  for (const [k, v] of Object.entries(stats)) {
    if (k.toLowerCase().replace(/[+%]/g, '') === lower) {
      if (v === null || v === undefined) return null;
      const n = Number(v);
      if (isNaN(n)) return String(v);
      return n < 1 && n > 0 ? n.toFixed(3) : n % 1 === 0 ? String(n) : n.toFixed(1);
    }
  }
  return null;
}

registerTemplate(template);
