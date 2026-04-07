import { parse } from 'csv-parse/sync';
import { fetchText } from '../utils/http.js';
import { log } from '../utils/logger.js';
import type {
  DataAdapter,
  AdapterQuery,
  AdapterResult,
  PlayerId,
  PlayerStats,
} from './types.js';

const FG_LEADERS_URL = 'https://www.fangraphs.com/api/leaders/major-league/data';

/**
 * FanGraphs adapter — fetches aggregated player stats via their leaderboard API.
 * Best for: season stats, leaderboards, wRC+, FIP, WAR, projections.
 */
export class FanGraphsAdapter implements DataAdapter {
  readonly source = 'fangraphs' as const;
  readonly description = 'FanGraphs — aggregated stats, leaderboards, WAR, wRC+, FIP';

  supports(query: AdapterQuery): boolean {
    // FanGraphs is best for aggregated season-level stats and leaderboards
    return true;
  }

  async resolvePlayer(name: string): Promise<PlayerId | null> {
    // FanGraphs doesn't have a clean player search API.
    // We search the leaderboard and match by name.
    // For robust resolution, we'd use the Chadwick Bureau register.
    log.debug(`FanGraphs: resolving player "${name}" via leaderboard search`);

    try {
      const season = new Date().getFullYear();
      const params = new URLSearchParams({
        pos: 'all',
        stats: 'bat',
        lg: 'all',
        qual: '0',
        season: String(season),
        month: '0',
        ind: '0',
        team: '',
        pageitems: '500',
        pagenum: '1',
        type: '8', // standard stats
      });

      const data = await fetchText(`${FG_LEADERS_URL}?${params}`);
      const parsed = JSON.parse(data);

      const nameNorm = name.toLowerCase().trim();
      const players = (parsed.data ?? []) as Record<string, unknown>[];
      const getName = (p: Record<string, unknown>) =>
        String(p.PlayerName ?? p.Name ?? '').toLowerCase().trim();

      // Exact match first, then token-based fuzzy match
      let match = players.find((p) => getName(p) === nameNorm);
      if (!match) {
        const tokens = nameNorm.split(/\s+/);
        match = players.find((p) => {
          const words = getName(p).split(/\s+/);
          return tokens.every((t) => words.some((w) => w.startsWith(t)));
        });
        if (match) {
          log.debug(`FanGraphs: fuzzy match for "${name}" → "${getName(match)}"`);
        }
      }

      if (!match) return null;

      return {
        mlbam_id: String(match.xMLBAMID ?? ''),
        fangraphs_id: String(match.playerid ?? ''),
        name: String(match.PlayerName ?? match.Name),
        team: String(match.Team ?? ''),
      };
    } catch (error) {
      log.warn(`FanGraphs player resolution failed: ${error}`);
      return null;
    }
  }

  async fetch(
    query: AdapterQuery,
    options?: { bypassCache?: boolean },
  ): Promise<AdapterResult<PlayerStats[]>> {
    const statType = query.stat_type === 'batting' ? 'bat' : 'pit';

    const params = new URLSearchParams({
      pos: 'all',
      stats: statType,
      lg: 'all',
      qual: String(query.min_pa ?? query.min_ip ?? 0),
      season: String(query.season),
      month: '0',
      ind: '0',
      team: query.team ? await this.resolveTeamId(query.team) : '',
      pageitems: '500',
      pagenum: '1',
      type: '8', // standard + advanced stats
    });

    const url = `${FG_LEADERS_URL}?${params}`;
    log.info('Fetching stats from FanGraphs...');
    log.debug(`FanGraphs URL: ${url}`);

    const raw = await fetchText(url);
    const parsed = JSON.parse(raw);
    const rows: Record<string, unknown>[] = parsed.data ?? [];

    // If searching for a specific player, filter
    let filtered = rows;
    if (query.player_name) {
      const nameNorm = query.player_name.toLowerCase().trim();
      const getName = (r: Record<string, unknown>) =>
        String(r.PlayerName ?? r.Name ?? '').toLowerCase().trim();

      // Exact match first, then token-based fuzzy match
      const exact = rows.filter((r) => getName(r) === nameNorm);
      if (exact.length > 0) {
        filtered = exact;
      } else {
        const tokens = nameNorm.split(/\s+/);
        filtered = rows.filter((r) => {
          const words = getName(r).split(/\s+/);
          return tokens.every((t) => words.some((w) => w.startsWith(t)));
        });
      }
    }

    const stats: PlayerStats[] = filtered.map((row) => ({
      player_id: String(row.xMLBAMID ?? row.playerid ?? ''),
      player_name: String(row.PlayerName ?? row.Name ?? ''),
      team: String(row.Team ?? ''),
      season: query.season,
      stat_type: query.stat_type,
      stats: row as Record<string, string | number | null>,
    }));

    log.success(`Fetched ${stats.length} player(s) from FanGraphs`);

    return {
      data: stats,
      source: this.source,
      cached: false,
      fetchedAt: new Date().toISOString(),
      meta: { rowCount: stats.length, season: query.season, query },
    };
  }

  private async resolveTeamId(abbrev: string): Promise<string> {
    // FanGraphs uses team IDs, not abbreviations. Common mappings:
    const TEAM_IDS: Record<string, string> = {
      LAA: '1', ARI: '15', BAL: '2', BOS: '3', CHC: '17', CHW: '4',
      CIN: '18', CLE: '5', COL: '19', DET: '6', HOU: '21', KC: '7',
      LAD: '22', MIA: '20', MIL: '23', MIN: '8', NYM: '25', NYY: '9',
      OAK: '10', PHI: '26', PIT: '27', SD: '29', SF: '30', SEA: '11',
      STL: '28', TB: '12', TEX: '13', TOR: '14', WSH: '24', ATL: '16',
    };
    return TEAM_IDS[abbrev.toUpperCase()] ?? '';
  }
}
