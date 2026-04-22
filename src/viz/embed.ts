import { viz } from '../commands/viz.js';
import type { ChartType, VizAudience } from './types.js';
import type { Audience } from '../templates/reports/registry.js';
import type { StdinAdapter } from '../adapters/stdin.js';

/**
 * Map from report template id → graph slots to inject into the Handlebars
 * context under the `graphs` key. Each slot produces one SVG string.
 */
const REPORT_GRAPH_MAP: Record<
  string,
  { slot: string; type: ChartType }[]
> = {
  'advance-sp': [
    // BBDATA-010: the advance-sp template is designed for tablet use during a
    // game, so its inline movement chart uses the binned variant (~10x smaller
    // SVG than the per-pitch chart) to keep total report size manageable.
    // pro-pitcher-eval stays on the unbinned chart — it's a desk document where
    // per-pitch detail is worth the byte cost.
    { slot: 'movementChart', type: 'movement-binned' },
  ],
  'pro-pitcher-eval': [
    { slot: 'movementChart', type: 'movement' },
    // F1.1: pro-pitcher-eval uses the pitcher-specific rolling chart, which
    // sources from `pitcher-rolling-trend` (FB velo + Whiff/K/CSW %). The
    // generic `rolling` chart is hitter-only — its query template hardcodes
    // `stat_type: 'batting'` and returns AVG/SLG/K%/Avg EV, which is empty
    // for pitchers.
    { slot: 'rollingChart', type: 'pitcher-rolling' },
  ],
  'pro-hitter-eval': [
    { slot: 'sprayChart', type: 'spray' },
    { slot: 'zoneChart', type: 'zone' },
    { slot: 'rollingChart', type: 'rolling' },
  ],
};

/**
 * Generate all graphs for a given report template and return them keyed by
 * slot name. Report Handlebars templates reference slots via `{{{graphs.X}}}`.
 *
 * Graphs that fail to generate (missing data, query errors) resolve to an
 * empty string; templates should guard with `{{#if graphs.X}}`.
 *
 * When called from a report invoked with `--stdin` or `--data`, the parent
 * passes its pre-loaded `stdinAdapter` through so every embedded viz call
 * shares the same payload — stdin can only be consumed once per process, and
 * re-reading file data per slot would be wasteful.
 */
export async function generateReportGraphs(
  reportId: string,
  player: string,
  season: number,
  audience: Audience | VizAudience,
  opts: { stdinAdapter?: StdinAdapter } = {},
): Promise<Record<string, string>> {
  const slots = REPORT_GRAPH_MAP[reportId] ?? [];
  const out: Record<string, string> = {};
  for (const { slot, type } of slots) {
    try {
      const r = await viz({
        type,
        player,
        season,
        audience,
        ...(opts.stdinAdapter ? { source: 'stdin', stdinAdapter: opts.stdinAdapter } : {}),
      });
      out[slot] = r.svg;
    } catch {
      out[slot] = '';
    }
  }
  return out;
}
