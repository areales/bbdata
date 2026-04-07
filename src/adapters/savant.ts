import { parse } from 'csv-parse/sync';
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
    const params = new URLSearchParams({
      all: 'true',
      type: 'detail',
      ...(query.stat_type === 'pitching'
        ? { player_type: 'pitcher', pitchers_lookup: playerId ?? '' }
        : { player_type: 'batter', batters_lookup: playerId ?? '' }),
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

    // Parse CSV into typed PitchData objects
    const rawRows = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      cast: true,
      cast_date: false,
    }) as Record<string, unknown>[];

    const data: PitchData[] = rawRows.map((row) => ({
      pitcher_id: String(row.pitcher ?? ''),
      pitcher_name: String(row.player_name ?? ''),
      batter_id: String(row.batter ?? ''),
      batter_name: String(row.batter_name ?? row.stand ?? ''),
      game_date: String(row.game_date ?? ''),
      pitch_type: String(row.pitch_type ?? ''),
      release_speed: Number(row.release_speed) || 0,
      release_spin_rate: Number(row.release_spin_rate) || 0,
      pfx_x: Number(row.pfx_x) || 0,
      pfx_z: Number(row.pfx_z) || 0,
      plate_x: Number(row.plate_x) || 0,
      plate_z: Number(row.plate_z) || 0,
      launch_speed: row.launch_speed != null ? Number(row.launch_speed) || null : null,
      launch_angle: row.launch_angle != null ? Number(row.launch_angle) || null : null,
      description: String(row.description ?? ''),
      events: row.events ? String(row.events) : null,
      bb_type: row.bb_type ? String(row.bb_type) : null,
      stand: (String(row.stand ?? 'R') as 'L' | 'R'),
      p_throws: (String(row.p_throws ?? 'R') as 'L' | 'R'),
      estimated_ba: row.estimated_ba_using_speedangle != null
        ? Number(row.estimated_ba_using_speedangle) || null
        : null,
      estimated_woba: row.estimated_woba_using_speedangle != null
        ? Number(row.estimated_woba_using_speedangle) || null
        : null,
    }));

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
