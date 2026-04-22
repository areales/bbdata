import { log } from '../utils/logger.js';
import type {
  DataAdapter,
  AdapterQuery,
  AdapterResult,
  PlayerId,
  PitchData,
  PlayerStats,
} from './types.js';

/**
 * Stdin adapter — reads pre-fetched JSON data from stdin.
 *
 * This enables bbdata to work in sandboxed environments (e.g. Anthropic
 * Managed Agent sandbox) where outbound HTTP is blocked. The caller
 * pre-fetches data and pipes it in:
 *
 *   echo '<json>' | bbdata query pitcher-arsenal --player "Name" --stdin
 *
 * Expected stdin JSON shape:
 *   {
 *     "data": PitchData[] | PlayerStats[],
 *     "player": { "mlbam_id": "...", "name": "...", ... }   // optional
 *   }
 */
export class StdinAdapter implements DataAdapter {
  readonly source = 'stdin' as const;
  readonly description = 'Local data from stdin (for sandboxed environments)';

  private data: (PitchData | PlayerStats)[] = [];
  private player: PlayerId | null = null;
  private loaded = false;

  /**
   * Load data from a pre-read stdin string.
   * Called by the CLI before the adapter is used.
   */
  load(raw: string): void {
    try {
      const parsed = JSON.parse(raw);

      // Support both { data: [...] } wrapper and raw array
      if (Array.isArray(parsed)) {
        this.data = parsed;
      } else if (parsed.data && Array.isArray(parsed.data)) {
        this.data = parsed.data;
        if (parsed.player) {
          this.player = parsed.player;
        }
      } else {
        throw new Error('Expected JSON array or { "data": [...] } object');
      }

      this.loaded = true;
      log.info(`Stdin adapter loaded ${this.data.length} records`);
    } catch (error) {
      throw new Error(
        `Failed to parse stdin data: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    }
  }

  /**
   * Load pre-parsed records directly (skips JSON.parse).
   * Used by the `--data <path>.csv` input path, where the CSV parser has
   * already produced typed records.
   */
  loadRecords(data: (PitchData | PlayerStats)[], player?: PlayerId): void {
    this.data = data;
    if (player) this.player = player;
    this.loaded = true;
    log.info(`Stdin adapter loaded ${this.data.length} records`);
  }

  supports(_query: AdapterQuery): boolean {
    // Loaded-but-empty payloads are still a valid stdin invocation. Returning
    // true lets the query layer produce its explicit "0 rows" guidance instead
    // of incorrectly classifying stdin as an unsupported adapter.
    return this.loaded;
  }

  async fetch(query: AdapterQuery): Promise<AdapterResult> {
    if (!this.loaded) {
      throw new Error('Stdin adapter has no data — pipe JSON via stdin with --stdin flag');
    }

    // Honor `query.pitch_type` on pitch-level records so `--pitch-type FF` works
    // the same way with `--data` / `--stdin` as with network adapters (gap G.7
    // in COURSE_TEST_PLAN). Other query fields (season, team, date range) are
    // not applied — the stdin payload is expected to already be scoped.
    const filtered = this.applyPitchTypeFilter(this.data, query);

    // TS variance: `(PitchData | PlayerStats)[]` is not assignable to
    // `PitchData[] | PlayerStats[]`. At runtime every record came from a
    // single payload so the array is homogeneous — cast to the adapter
    // result type.
    return {
      data: filtered as PitchData[] | PlayerStats[],
      source: 'stdin',
      cached: false,
      fetchedAt: new Date().toISOString(),
      meta: {
        rowCount: filtered.length,
        season: query.season,
        query,
      },
    };
  }

  private applyPitchTypeFilter(
    records: (PitchData | PlayerStats)[],
    query: AdapterQuery,
  ): (PitchData | PlayerStats)[] {
    const allowed = query.pitch_type;
    if (!allowed || allowed.length === 0) return records;

    // Only pitch-level records carry `pitch_type`. Season-aggregate PlayerStats
    // rows pass through untouched — the filter is a no-op on that shape.
    const wanted = new Set(allowed.map((p) => p.toUpperCase()));
    return records.filter((record) => {
      const pt = (record as PitchData).pitch_type;
      if (pt === undefined) return true;
      return wanted.has(pt.toUpperCase());
    });
  }

  async resolvePlayer(name: string): Promise<PlayerId | null> {
    // If player info was provided in stdin payload, use it
    if (this.player && this.player.name.toLowerCase() === name.toLowerCase()) {
      return this.player;
    }

    // Try to infer from the data itself
    const firstRecord = this.data[0] as Record<string, unknown>;
    if (firstRecord) {
      const id = (firstRecord.pitcher_id ?? firstRecord.player_id ?? '') as string;
      const recordName = (firstRecord.pitcher_name ?? firstRecord.player_name ?? name) as string;
      if (id) {
        return {
          mlbam_id: id,
          name: recordName,
        };
      }
    }

    return null;
  }
}
