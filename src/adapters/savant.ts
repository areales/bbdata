import { fetchText } from '../utils/http.js';
import { log } from '../utils/logger.js';
import type {
  DataAdapter,
  AdapterQuery,
  AdapterResult,
  PlayerId,
  PitchData,
} from './types.js';
import { MlbStatsApiAdapter } from './mlb-stats-api.js';
import { parseSavantCsv } from './savant-csv.js';

const SAVANT_SEARCH_URL = 'https://baseballsavant.mlb.com/statcast_search/csv';

/**
 * Baseball Savant adapter — fetches pitch-level Statcast data as CSV.
 * This is the richest data source: every pitch with velocity, spin, movement, location, and outcomes.
 */
export class SavantAdapter implements DataAdapter {
  readonly source = 'savant' as const;
  readonly description = 'Baseball Savant (Statcast) — pitch-level data via CSV export';

  // Use MLB API for player resolution since Savant needs MLBAM IDs
  private mlbApi = new MlbStatsApiAdapter();

  supports(query: AdapterQuery): boolean {
    // Savant is best for pitch-level data. It requires a player or narrow date range.
    return !!(query.player_name || query.player_id || (query.start_date && query.end_date));
  }

  async resolvePlayer(name: string): Promise<PlayerId | null> {
    return this.mlbApi.resolvePlayer(name);
  }

  async fetch(
    query: AdapterQuery,
    options?: { bypassCache?: boolean },
  ): Promise<AdapterResult<PitchData[]>> {
    // Resolve player ID
    let playerId = query.player_id;
    if (!playerId && query.player_name) {
      const resolved = await this.resolvePlayer(query.player_name);
      if (!resolved) {
        throw new Error(`Player not found: "${query.player_name}"`);
      }
      playerId = resolved.mlbam_id;
    }

    // Build Savant CSV search URL
    // Note: Savant expects array-style param names (e.g., pitchers_lookup[]) for player IDs
    //
    // BBDATA-007: hfGT is Savant's "game type" filter. The value is a
    // pipe-delimited set of game-type codes (R=regular, S=spring training,
    // E=exhibition, F=wild-card, D=division series, L=LCS, W=World Series).
    // `R|` restricts results to regular-season games only. This prevents
    // rolling-window queries from blending spring-training at-bats into
    // early-April windows and keeps season aggregates aligned with what fans
    // and scouts mean by "2025 stats." The `game_type=R` param name (plain)
    // is silently ignored by the CSV endpoint — only `hfGT=R|` actually
    // filters. Discovered by empirical testing: game_type=R returned 317
    // rows including S rows, hfGT=R| returned 135 rows all R.
    const params = new URLSearchParams({
      all: 'true',
      type: 'details',
      hfGT: 'R|',
      ...(query.stat_type === 'pitching'
        ? { player_type: 'pitcher', 'pitchers_lookup[]': playerId ?? '' }
        : { player_type: 'batter', 'batters_lookup[]': playerId ?? '' }),
      ...(query.start_date
        ? { game_date_gt: query.start_date }
        : { game_date_gt: `${query.season}-01-01` }),
      ...(query.end_date
        ? { game_date_lt: query.end_date }
        : { game_date_lt: `${query.season}-12-31` }),
    });

    if (query.pitch_type?.length) {
      params.set('pitch_type', query.pitch_type.join(','));
    }

    const url = `${SAVANT_SEARCH_URL}?${params}`;
    log.info(`Fetching Statcast data from Baseball Savant...`);
    log.debug(`Savant URL: ${url}`);

    const csvText = await fetchText(url, { timeout: 60_000 });

    if (!csvText.trim() || csvText.includes('No Results')) {
      return {
        data: [],
        source: this.source,
        cached: false,
        fetchedAt: new Date().toISOString(),
        meta: { rowCount: 0, season: query.season, query },
      };
    }

    // Parse CSV into typed PitchData objects. Shared with the `--data <path>.csv`
    // input path so both entry points stay field-for-field in sync.
    const data = parseSavantCsv(csvText);

    // Log when headers present but no data rows (player may not have played in date range)
    if (data.length === 0 && csvText.trim().length > 50) {
      log.debug('Savant returned headers but no data rows');
    }

    log.success(`Fetched ${data.length} pitches from Savant`);

    return {
      data,
      source: this.source,
      cached: false,
      fetchedAt: new Date().toISOString(),
      meta: { rowCount: data.length, season: query.season, query },
    };
  }
}
