import { viz } from '../commands/viz.js';
import type { ChartType, VizAudience } from './types.js';
import type { Audience } from '../templates/reports/registry.js';

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
    { slot: 'rollingChart', type: 'rolling' },
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
 * When called from a report that was invoked with `--stdin`, the stdin
 * adapter is already loaded by the caller; we pass `source: 'stdin'` to
 * route viz's internal query through the same adapter instead of re-reading
 * stdin (which would hang forever — stdin can only be consumed once).
 */
export async function generateReportGraphs(
  reportId: string,
  player: string,
  season: number,
  audience: Audience | VizAudience,
  opts: { stdin?: boolean } = {},
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
        ...(opts.stdin ? { source: 'stdin' } : {}),
      });
      out[slot] = r.svg;
    } catch {
      out[slot] = '';
    }
  }
  return out;
}
