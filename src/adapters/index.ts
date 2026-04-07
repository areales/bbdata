import type { DataAdapter, DataSource } from './types.js';
import { MlbStatsApiAdapter } from './mlb-stats-api.js';
import { SavantAdapter } from './savant.js';
import { FanGraphsAdapter } from './fangraphs.js';
import { BaseballReferenceAdapter } from './baseball-reference.js';

const adapters: Record<DataSource, DataAdapter> = {
  'mlb-stats-api': new MlbStatsApiAdapter(),
  'savant': new SavantAdapter(),
  'fangraphs': new FanGraphsAdapter(),
  'baseball-reference': new BaseballReferenceAdapter(),
};

export function getAdapter(source: DataSource): DataAdapter {
  return adapters[source];
}

export function getAllAdapters(): DataAdapter[] {
  return Object.values(adapters);
}

export function resolveAdapters(
  preferred: DataSource[],
): DataAdapter[] {
  return preferred.map((source) => adapters[source]).filter(Boolean);
}
