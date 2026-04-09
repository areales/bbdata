import { registerTemplate, type QueryTemplate } from './registry.js';
import type { PlayerStats } from '../../adapters/types.js';

const template: QueryTemplate = {
  id: 'leaderboard-custom',
  name: 'Custom Leaderboard',
  category: 'leaderboard',
  description: 'Top N players by any metric — with minimum qualification thresholds',
  preferredSources: ['fangraphs', 'mlb-stats-api'],
  requiredParams: ['stat'],
  optionalParams: ['season', 'team', 'top', 'minPa', 'minIp'],
  examples: [
    'bbdata query leaderboard-custom --stat barrel_rate --min-pa 200 --top 20',
    'bbdata query leaderboard-custom --stat ERA --min-ip 100 --top 10 --format table',
  ],

  buildQuery(params) {
    const pitchingStats = ['era', 'fip', 'xfip', 'siera', 'whip', 'k/9', 'bb/9', 'hr/9', 'ip', 'w', 'sv', 'hld'];
    const isPitching = pitchingStats.includes((params.stat ?? '').toLowerCase());
    return {
      season: params.season ?? new Date().getFullYear(),
      team: params.team,
      stat_type: isPitching ? 'pitching' : 'batting',
      min_pa: params.minPa,
      min_ip: params.minIp,
    };
  },

  columns(params) {
    return ['Rank', 'Player', 'Team', params.stat ?? 'Stat', 'PA/IP'];
  },

  transform(data, params) {
    const stats = data as PlayerStats[];
    if (stats.length === 0) return [];

    const statKey = params.stat ?? '';
    const top = params.top ?? 20;

    // Find the stat in each player's stats object (case-insensitive search)
    const withStat = stats
      .map((player) => {
        const value = findStat(player.stats, statKey);
        return { player, value };
      })
      .filter((p) => p.value !== null)
      .sort((a, b) => {
        // ERA, FIP, etc. sort ascending; most others descending
        const ascending = ['era', 'fip', 'xfip', 'siera', 'whip', 'bb%'].includes(
          statKey.toLowerCase(),
        );
        return ascending
          ? (a.value as number) - (b.value as number)
          : (b.value as number) - (a.value as number);
      })
      .slice(0, top);

    return withStat.map((entry, idx) => ({
      Rank: idx + 1,
      Player: entry.player.player_name,
      Team: entry.player.team,
      [statKey]: typeof entry.value === 'number'
        ? entry.value < 1 && entry.value > 0
          ? entry.value.toFixed(3)
          : entry.value.toFixed(1)
        : String(entry.value),
      'PA/IP': entry.player.stats.plateAppearances ?? entry.player.stats.PA
        ?? entry.player.stats.inningsPitched ?? entry.player.stats.IP ?? '—',
    }));
  },
};

function findStat(stats: Record<string, unknown>, key: string): number | null {
  // Direct match
  if (key in stats) {
    const val = Number(stats[key]);
    return isNaN(val) ? null : val;
  }
  // Case-insensitive match
  const lower = key.toLowerCase();
  for (const [k, v] of Object.entries(stats)) {
    if (k.toLowerCase() === lower || k.toLowerCase().replace(/[_%]/g, '') === lower.replace(/[_%]/g, '')) {
      const val = Number(v);
      return isNaN(val) ? null : val;
    }
  }
  return null;
}

registerTemplate(template);
