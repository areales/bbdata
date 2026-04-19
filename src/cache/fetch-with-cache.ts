import type { DataAdapter, AdapterQuery, AdapterResult } from '../adapters/types.js';
import { getCached, setCache } from './store.js';
import { log } from '../utils/logger.js';

export interface CachePolicy {
  enabled: boolean;
  maxAgeDays: number;
}

/**
 * Wrap an adapter fetch with the bbdata response cache.
 *
 * Read path: on hit, returns the cached `AdapterResult` with `cached: true`
 * and no adapter call. Write path: on miss, calls the adapter with
 * `bypassCache: true` (so adapters never double-cache) and stores the
 * result. Errors from the store are swallowed as non-critical — a cache
 * miss or a failed write never breaks the live fetch path.
 *
 * `stdin` is excluded from caching entirely — it's a local in-memory
 * data path, not a network source.
 */
export async function fetchWithCache(
  adapter: DataAdapter,
  query: AdapterQuery,
  policy: CachePolicy,
): Promise<AdapterResult> {
  const skipCache = !policy.enabled || adapter.source === 'stdin';

  if (skipCache) {
    return adapter.fetch(query, { bypassCache: true });
  }

  const key = query as unknown as Record<string, unknown>;
  const cached = await getCached(adapter.source, key);
  if (cached) {
    try {
      const parsed = JSON.parse(cached) as AdapterResult;
      log.debug(`Cache hit for ${adapter.source}`);
      return { ...parsed, cached: true };
    } catch {
      log.debug(`Cache entry for ${adapter.source} was corrupt; refetching`);
    }
  }

  const result = await adapter.fetch(query, { bypassCache: true });
  try {
    await setCache(adapter.source, key, JSON.stringify(result), policy.maxAgeDays);
  } catch {
    // Non-critical — cache write failed
  }
  return { ...result, cached: false };
}
