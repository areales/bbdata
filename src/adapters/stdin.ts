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
        `Failed to parse stdin data: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  supports(_query: AdapterQuery): boolean {
    return this.loaded && this.data.length > 0;
  }

  async fetch(query: AdapterQuery): Promise<AdapterResult> {
    if (!this.loaded) {
      throw new Error('Stdin adapter has no data — pipe JSON via stdin with --stdin flag');
    }

    return {
      data: this.data,
      source: 'stdin',
      cached: false,
      fetchedAt: new Date().toISOString(),
      meta: {
        rowCount: this.data.length,
        season: query.season,
        query,
      },
    };
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
