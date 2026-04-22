import type { ChartBuilder, ChartType } from '../types.js';
import { movementBuilder } from './movement.js';
import { movementBinnedBuilder } from './movement-binned.js';
import { sprayBuilder } from './spray.js';
import { zoneBuilder } from './zone.js';
import { rollingBuilder } from './rolling.js';
import { pitcherRollingBuilder } from './pitcher-rolling.js';

const builders: Record<ChartType, ChartBuilder> = {
  movement: movementBuilder,
  'movement-binned': movementBinnedBuilder,
  spray: sprayBuilder,
  zone: zoneBuilder,
  rolling: rollingBuilder,
  'pitcher-rolling': pitcherRollingBuilder,
};

/**
 * Domain-prefixed aliases mapped to canonical chart type ids. The course
 * deliverable at `ai-baseball-data-analyst/Modules/04/Deliverables/...` uses
 * these prefixed names in every example. Keeping this map small and unidirectional
 * (alias → canonical) keeps `listChartTypes()` stable for the existing test
 * fixtures while letting the course's command strings work as written.
 */
const aliases: Record<string, ChartType> = {
  'pitching-movement': 'movement',
  'hitting-spray': 'spray',
  'hitting-zones': 'zone',
  'trend-rolling': 'rolling',
};

export function resolveChartType(type: string): ChartType | undefined {
  if (type in builders) return type as ChartType;
  return aliases[type];
}

export function getChartBuilder(type: string): ChartBuilder {
  const canonical = resolveChartType(type);
  if (!canonical) {
    const all = [...Object.keys(builders), ...Object.keys(aliases)].join(', ');
    throw new Error(`Unknown chart type: "${type}". Available: ${all}`);
  }
  return builders[canonical];
}

export function listChartTypes(): ChartType[] {
  return Object.keys(builders) as ChartType[];
}

export function listChartAliases(): Record<string, ChartType> {
  return { ...aliases };
}
