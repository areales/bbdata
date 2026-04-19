import type { DataAdapter, DataSource } from './types.js';
import { MlbStatsApiAdapter } from './mlb-stats-api.js';
import { SavantAdapter } from './savant.js';
import { FanGraphsAdapter } from './fangraphs.js';
import { BaseballReferenceAdapter } from './baseball-reference.js';
import { StdinAdapter } from './stdin.js';

// Network-fetch adapters are stateless and safe to share as module singletons.
// The stdin adapter is deliberately NOT listed here — it holds per-invocation
// payload state, so callers must construct one via `createStdinAdapter()` and
// pass it to `resolveAdapters(..., { stdin: adapter })`. This prevents the
// cross-call state leakage described in R1.3 (Codex review 2026-04-19).
const staticAdapters: Record<Exclude<DataSource, 'stdin'>, DataAdapter> = {
  'mlb-stats-api': new MlbStatsApiAdapter(),
  'savant': new SavantAdapter(),
  'fangraphs': new FanGraphsAdapter(),
  'baseball-reference': new BaseballReferenceAdapter(),
};

/** Construct a fresh stdin adapter for a single invocation. */
export function createStdinAdapter(): StdinAdapter {
  return new StdinAdapter();
}

export function getAdapter(source: DataSource): DataAdapter | undefined {
  if (source === 'stdin') return undefined;
  return staticAdapters[source];
}

export function getAllAdapters(): DataAdapter[] {
  return Object.values(staticAdapters);
}

export function resolveAdapters(
  preferred: DataSource[],
  overrides: Partial<Record<DataSource, DataAdapter>> = {},
): DataAdapter[] {
  return preferred
    .map((source) => {
      const override = overrides[source];
      if (override) return override;
      if (source === 'stdin') return undefined;
      return staticAdapters[source];
    })
    .filter((adapter): adapter is DataAdapter => Boolean(adapter));
}
