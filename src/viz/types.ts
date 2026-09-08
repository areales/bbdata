import type { Audience } from '../templates/reports/registry.js';
import type { StdinAdapter } from '../adapters/stdin.js';

export type ChartType =
  | 'movement'
  | 'movement-binned'
  | 'spray'
  | 'zone'
  | 'rolling'
  | 'pitcher-rolling'
  | 'comparison';

/**
 * P5.1: the field a comparison builder's rows are tagged with so a spec can
 * split them by player. A shared constant because `viz()` writes it and the
 * builder reads it — an implicit string on both sides is how these two drift.
 */
export const COMPARISON_PLAYER_FIELD = '__player';
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
  /** Path to a local .json or .csv file to use instead of fetching. */
  data?: string;
  cache?: boolean;
  title?: string;
  /** Rolling-window size (games) — only meaningful for the `rolling` chart. */
  window?: number;
  /** Target DPI for raster formats (png, or pdf with pdfMode='raster'). */
  dpi?: number;
  /**
   * PDF rendering strategy. `vector` (default) embeds the SVG natively via
   * svg-to-pdfkit; `raster` rasterizes to PNG via resvg first. Switch to
   * `raster` for Vega specs that svg-to-pdfkit renders imperfectly.
   */
  pdfMode?: 'vector' | 'raster';
  /**
   * Internal plumbing: a pre-loaded StdinAdapter supplied by a parent
   * command (e.g. `report()` → `generateReportGraphs()` → `viz()`) so a
   * single stdin payload can serve many sub-viz calls without re-reading
   * stdin. Skills and agents calling `viz()` directly typically don't set
   * this — use `stdin` or `data` instead.
   */
  stdinAdapter?: StdinAdapter;
}

export interface VizResult {
  formatted: string | Buffer;
  svg: string;
  spec: object;
  meta: {
    chartType: ChartType;
    format: VizFormat;
    player: string;
    season: number;
    audience: VizAudience;
    rowCount: number;
    source: string;
    width: number;
    height: number;
    /** bbdata build that produced this chart. */
    cliVersion: string;
    /**
     * Every player plotted, when this is a comparison chart. Additive rather
     * than overloading `player` with a joined string — `player` feeds
     * `defaultTitle` and the report embed, and both expect one name.
     */
    players?: string[];
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
  /**
   * P5.1: whether this builder plots more than one player. `viz()` fetches
   * once per name and tags rows with COMPARISON_PLAYER_FIELD only for these;
   * every other chart rejects `--players` instead of silently ignoring it.
   */
  supportsComparison?: boolean;
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
      // P4.8: a typo used to silently coerce to analyst styling.
      throw new Error(
        `Unknown --audience "${String(a)}". Expected one of: coach, analyst, frontoffice, presentation ` +
          `(aliases: gm → frontoffice, scout → analyst).`,
      );
  }
}
