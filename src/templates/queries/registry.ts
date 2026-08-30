import type { DataSource, AdapterQuery, PitchData, PlayerStats } from '../../adapters/types.js';

export type QueryCategory = 'pitcher' | 'hitter' | 'matchup' | 'leaderboard' | 'trend';

export interface QueryTemplateParams {
  player?: string;
  players?: string[];
  team?: string;
  season?: number;
  stat?: string;
  pitchType?: string;
  minPa?: number;
  minIp?: number;
  /** Minimum pitches faced per pitch type for hitter-vs-pitch-type (default 20). */
  minPitches?: number;
  top?: number;
  seasons?: string; // "2023-2025"
  /** Rolling-window size (games) for trend-rolling-average. Template-specific. */
  window?: number;
}

export interface QueryResult {
  rows: Record<string, unknown>[];
  columns: string[];
  title: string;
  description: string;
  source: DataSource;
  cached: boolean;
  columnFormats?: Record<string, ColumnFormat>;
}

/**
 * Display hint for a numeric column, consumed by the table/markdown
 * formatters. Without a hint, numbers render as-is (integers stay
 * integers; sub-1 floats get 3 decimals, others 1). A magnitude
 * heuristic cannot distinguish a ratio from an index or a count, so
 * percent rendering only ever happens when a template declares it.
 */
export type ColumnFormat =
  | 'percent' // ratio 0.186 → "18.6%" (already-scaled values pass through)
  | { decimals: number }; // fixed decimal places, e.g. { decimals: 2 } → "0.95"

export interface QueryTemplate {
  id: string;
  name: string;
  category: QueryCategory;
  description: string;
  preferredSources: DataSource[];
  requiredParams: (keyof QueryTemplateParams)[];
  optionalParams: (keyof QueryTemplateParams)[];
  examples: string[];

  /** Build the adapter query from user-provided params */
  buildQuery(params: QueryTemplateParams): AdapterQuery;

  /** Transform raw adapter data into display rows */
  transform(data: PitchData[] | PlayerStats[], params: QueryTemplateParams): Record<string, unknown>[];

  /** Column names for display */
  columns(params: QueryTemplateParams): string[];

  /** Optional per-column display hints for table/markdown output */
  columnFormats?(params: QueryTemplateParams): Record<string, ColumnFormat>;
}

// Template registry
const templates = new Map<string, QueryTemplate>();

export function registerTemplate(template: QueryTemplate): void {
  templates.set(template.id, template);
}

export function getTemplate(id: string): QueryTemplate | undefined {
  return templates.get(id);
}

export function getAllTemplates(): QueryTemplate[] {
  return Array.from(templates.values());
}

export function getTemplatesByCategory(category: QueryCategory): QueryTemplate[] {
  return getAllTemplates().filter((t) => t.category === category);
}

export function listTemplates(): { id: string; name: string; category: string; description: string }[] {
  return getAllTemplates().map((t) => ({
    id: t.id,
    name: t.name,
    category: t.category,
    description: t.description,
  }));
}
