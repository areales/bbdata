// Programmatic API — skills and agents import from here
export { query } from './commands/query.js';
export { report } from './commands/report.js';
export { getConfig, setConfig } from './config/config.js';

// Types
export type { BbdataConfig } from './config/defaults.js';
export type { DataAdapter, AdapterQuery, PitchData, PlayerStats } from './adapters/types.js';
export type { QueryResult, QueryOptions } from './commands/query.js';
export type { ReportResult, ReportOptions } from './commands/report.js';
export type { OutputFormat } from './formatters/json.js';
