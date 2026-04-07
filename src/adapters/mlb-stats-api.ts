import { fetchJson } from '../utils/http.js';
import { log } from '../utils/logger.js';
import type {
  DataAdapter,
  AdapterQuery,
  AdapterResult,
  PlayerId,
  PlayerStats,
} from './types.js';

const BASE_URL = 'https://statsapi.mlb.com/api/v1';

// MLB Stats API response types (partial — only what we use)
interface MlbPeopleResponse {
  people: Array<{
    id: number;
    fullName: string;
    currentTeam?: { abbreviation: string };
    primaryPosition?: { abbreviation: string };
  }>;
}

interface MlbStatsResponse {
  stats: Array<{
    splits: Array<{
      stat: Record<string, unknown>;
      season: string;
      team?: { abbreviation: string };
      player?: { id: number; fullName: string };
    }>;
  }>;
}

export class MlbStatsApiAdapter implements DataAdapter {
  readonly source = 'mlb-stats-api' as const;
  readonly description = 'Official MLB Stats API — rosters, schedules, season stats (JSON)';

  supports(query: AdapterQuery): boolean {
    // MLB Stats API provides season-level aggregated stats, not pitch-level
    // Good for: player lookup, season stats, rosters, schedules
    return true;
  }

  async resolvePlayer(name: string): Promise<PlayerId | null> {
    log.debug(`MLB API: resolving player "${name}"`);

    try {
      const data = await fetchJson<MlbPeopleResponse>(
        `${BASE_URL}/people/search?names=${encodeURIComponent(name)}&hydrate=currentTeam`,
      );

      if (!data.people?.length) return null;

      const player = data.people[0];
      return {
        mlbam_id: String(player.id),
        name: player.fullName,
        team: player.currentTeam?.abbreviation,
        position: player.primaryPosition?.abbreviation,
      };
    } catch (error) {
      log.warn(`Failed to resolve player "${name}" via MLB API: ${error}`);
      return null;
    }
  }

  async fetch(
    query: AdapterQuery,
    options?: { bypassCache?: boolean },
  ): Promise<AdapterResult<PlayerStats[]>> {
    // Resolve player ID if we have a name
    let playerId = query.player_id;
    let playerName = query.player_name ?? 'Unknown';

    if (!playerId && query.player_name) {
      const resolved = await this.resolvePlayer(query.player_name);
      if (!resolved) {
        throw new Error(`Player not found: "${query.player_name}"`);
      }
      playerId = resolved.mlbam_id;
      playerName = resolved.name;
    }

    const statGroup = query.stat_type === 'batting' ? 'hitting' : query.stat_type;
    const url = playerId
      ? `${BASE_URL}/people/${playerId}/stats?stats=season&season=${query.season}&group=${statGroup}`
      : `${BASE_URL}/stats?stats=season&season=${query.season}&group=${statGroup}&gameType=R&limit=50&sortStat=onBasePlusSlugging`;

    log.debug(`MLB API: fetching ${url}`);
    const data = await fetchJson<MlbStatsResponse>(url);

    const stats: PlayerStats[] = [];

    for (const statGroup of data.stats ?? []) {
      for (const split of statGroup.splits ?? []) {
        stats.push({
          player_id: playerId ?? String(split.player?.id ?? ''),
          player_name: playerName ?? split.player?.fullName ?? 'Unknown',
          team: split.team?.abbreviation ?? query.team ?? '',
          season: Number(split.season) || query.season,
          stat_type: query.stat_type,
          stats: split.stat as Record<string, string | number | null>,
        });
      }
    }

    return {
      data: stats,
      source: this.source,
      cached: false,
      fetchedAt: new Date().toISOString(),
      meta: {
        rowCount: stats.length,
        season: query.season,
        query,
      },
    };
  }
}
