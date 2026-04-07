import { log } from '../utils/logger.js';
import type {
  DataAdapter,
  AdapterQuery,
  AdapterResult,
  PlayerId,
  PlayerStats,
} from './types.js';

/**
 * Baseball Reference adapter — BETA.
 *
 * Baseball Reference serves HTML, not structured data. This adapter is a
 * placeholder that will be implemented incrementally. For now, it delegates
 * to the MLB Stats API for basic queries and logs a warning.
 *
 * Future implementation will use HTML parsing for:
 * - Historical stats (pre-Statcast era)
 * - Career game logs
 * - Minor league stats
 * - Transaction and injury history
 */
export class BaseballReferenceAdapter implements DataAdapter {
  readonly source = 'baseball-reference' as const;
  readonly description = 'Baseball Reference — historical stats, career data (BETA)';

  supports(_query: AdapterQuery): boolean {
    // Only enable when explicitly requested — this is not yet fully implemented
    return false;
  }

  async resolvePlayer(_name: string): Promise<PlayerId | null> {
    log.warn('Baseball Reference adapter is in beta — player resolution not yet implemented');
    return null;
  }

  async fetch(
    query: AdapterQuery,
    _options?: { bypassCache?: boolean },
  ): Promise<AdapterResult<PlayerStats[]>> {
    log.warn('Baseball Reference adapter is in beta — returning empty results');
    return {
      data: [],
      source: this.source,
      cached: false,
      fetchedAt: new Date().toISOString(),
      meta: { rowCount: 0, season: query.season, query },
    };
  }
}
