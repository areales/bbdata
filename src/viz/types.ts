import type { Audience } from '../templates/reports/registry.js';

export type ChartType = 'movement' | 'movement-binned' | 'spray' | 'zone' | 'rolling';
export type VizFormat = 'svg' | 'png' | 'pdf' | 'html';

/**
 * Audience vocabulary for visualization styling.
 * This is a superset of the report Audience type. The report layer uses
 * 'gm'/'scout' as role labels; the viz layer uses 'frontoffice'/'presentation'
 * as presentation-style labels. `resolveVizAudience` maps between them.
 */
export type VizAudience = 'coach' | 'analyst' | 'frontoffice' | 'presentation';

export interface VizOptions {
  type: ChartType | string;
  player?: string;
  players?: string[];
  season?: number;
  audience?: Audience | VizAudience;
  format?: VizFormat;
  width?: number;
  height?: number;
  colorblind?: boolean;
  output?: string;
  source?: string;
  stdin?: boolean;
  cache?: boolean;
  title?: string;
  /** Rolling-window size (games) — only meaningful for the `rolling` chart. */
  window?: number;
  /** Target DPI for raster formats (png/pdf). Scales width proportionally. */
  dpi?: number;
}

export interface VizResult {
  svg: string;
  spec: object;
  meta: {
    chartType: ChartType;
    player: string;
    season: number;
    audience: VizAudience;
    rowCount: number;
    source: string;
    width: number;
    height: number;
  };
}

export interface ResolvedVizOptions {
  type: ChartType;
  player: string;
  season: number;
  audience: VizAudience;
  format: VizFormat;
  width: number;
  height: number;
  colorblind: boolean;
  title: string;
  players?: string[];
  window?: number;
  dpi?: number;
}

export interface ChartDataRequirement {
  queryTemplate: string;
  required: boolean;
}

export interface ChartBuilder {
  id: ChartType;
  /** Query templates whose rows this builder consumes */
  dataRequirements: ChartDataRequirement[];
  /** Default chart title when the caller does not provide one */
  defaultTitle(options: Pick<ResolvedVizOptions, 'player' | 'season'>): string;
  /** Given fetched rows (keyed by query template id), produce a Vega-Lite spec */
  buildSpec(
    rows: Record<string, Record<string, unknown>[]>,
    options: ResolvedVizOptions,
  ): object;
}

/**
 * Map the report `Audience` vocabulary (coach|gm|scout|analyst) onto
 * the viz `VizAudience` vocabulary (coach|analyst|frontoffice|presentation).
 * Passes through if already a VizAudience.
 */
export function resolveVizAudience(
  a: Audience | VizAudience | undefined,
): VizAudience {
  if (!a) return 'analyst';
  switch (a) {
    case 'gm':
      return 'frontoffice';
    case 'scout':
      return 'analyst';
    case 'coach':
    case 'analyst':
    case 'frontoffice':
    case 'presentation':
      return a;
    default:
      return 'analyst';
  }
}
