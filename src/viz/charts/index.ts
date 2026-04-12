import type { ChartBuilder, ChartType } from '../types.js';
import { movementBuilder } from './movement.js';
import { movementBinnedBuilder } from './movement-binned.js';
import { sprayBuilder } from './spray.js';
import { zoneBuilder } from './zone.js';
import { rollingBuilder } from './rolling.js';

const builders: Record<ChartType, ChartBuilder> = {
  movement: movementBuilder,
  'movement-binned': movementBinnedBuilder,
  spray: sprayBuilder,
  zone: zoneBuilder,
  rolling: rollingBuilder,
};

export function getChartBuilder(type: ChartType): ChartBuilder {
  const b = builders[type];
  if (!b) {
    throw new Error(
      `Unknown chart type: "${type}". Available: ${Object.keys(builders).join(', ')}`,
    );
  }
  return b;
}

export function listChartTypes(): ChartType[] {
  return Object.keys(builders) as ChartType[];
}
