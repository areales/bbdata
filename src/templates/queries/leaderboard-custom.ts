import { registerTemplate, type QueryTemplate } from './registry.js';
import { assertFields } from '../../utils/validate-records.js';
import type { PlayerStats } from '../../adapters/types.js';
import { fmtPercent } from '../../utils/stat-format.js';


const REQUIRED_FIELDS = ['player_name'];

/**
 * Course-vocabulary aliases for FanGraphs stat keys (P1.12). The lesson
 * material teaches `_rate`-suffixed names; FanGraphs keys end in `%`.
 * Explicit entries only — a general suffix-stripping normalization would
 * collide `bb_rate` with the raw `BB` walk-count column, the exact
 * defect class P1.10 fixed in leaderboard-comparison.
 */
const STAT_ALIASES: Record<string, string> = {
  barrel_rate: 'Barrel%',
  hard_hit_rate: 'HardHit%',
  k_rate: 'K%',
  bb_rate: 'BB%',
};

function canonicalStatKey(key: string): string {
  return STAT_ALIASES[key.toLowerCase()] ?? key;
}

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
    assertFields(stats, REQUIRED_FIELDS, 'leaderboard-custom');


    const statKey = params.stat ?? '';
    const lookupKey = canonicalStatKey(statKey);
    const top = params.top ?? 20;

    // Find the stat in each player's stats object (case-insensitive search)
    const matched = stats
      .map((player) => {
        const value = findStat(player.stats, lookupKey);
        return { player, value };
      })
      .filter((p) => p.value !== null);

    // A stat key that resolves for no player is a caller error, not an
    // empty leaderboard — returning [] here used to masquerade as
    // "adapter returned 0 rows, try an earlier --season" (P1.12).
    if (matched.length === 0) {
      const available = Object.entries(stats[0].stats)
        .filter(([, v]) => v != null && v !== '' && !Number.isNaN(Number(v)))
        .map(([k]) => k)
        .sort();
      throw new Error(
        `Stat "${statKey}" not found in leaderboard data` +
          (lookupKey !== statKey ? ` (searched as "${lookupKey}")` : '') +
          `. Available stat keys: ${available.join(', ')}`,
      );
    }

    const withStat = matched
      .sort((a, b) => {
        // ERA, FIP, etc. sort ascending; most others descending
        const ascending = ['era', 'fip', 'xfip', 'siera', 'whip', 'bb%'].includes(
          lookupKey.toLowerCase(),
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
        ? lookupKey.endsWith('%')
          ? fmtPercent(entry.value)
          : entry.value < 1 && entry.value > 0
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
