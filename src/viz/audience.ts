import type { VizAudience } from './types.js';

export interface AudienceDefaults {
  width: number;
  height: number;
  titleFontSize: number;
  axisLabelFontSize: number;
  axisTitleFontSize: number;
  legendLabelFontSize: number;
  legendTitleFontSize: number;
  scheme: string;
  labelDensity: 'low' | 'medium' | 'high';
  padding: number;
}

export const AUDIENCE_DEFAULTS: Record<VizAudience, AudienceDefaults> = {
  coach: {
    width: 800,
    height: 600,
    titleFontSize: 22,
    axisLabelFontSize: 18,
    axisTitleFontSize: 18,
    legendLabelFontSize: 16,
    legendTitleFontSize: 16,
    scheme: 'tableau10',
    labelDensity: 'low',
    padding: 24,
  },
  analyst: {
    width: 640,
    height: 480,
    titleFontSize: 16,
    axisLabelFontSize: 12,
    axisTitleFontSize: 13,
    legendLabelFontSize: 11,
    legendTitleFontSize: 12,
    scheme: 'tableau10',
    labelDensity: 'high',
    padding: 12,
  },
  frontoffice: {
    width: 720,
    height: 540,
    titleFontSize: 18,
    axisLabelFontSize: 13,
    axisTitleFontSize: 14,
    legendLabelFontSize: 12,
    legendTitleFontSize: 13,
    scheme: 'tableau10',
    labelDensity: 'medium',
    padding: 16,
  },
  presentation: {
    width: 960,
    height: 720,
    titleFontSize: 24,
    axisLabelFontSize: 16,
    axisTitleFontSize: 18,
    legendLabelFontSize: 14,
    legendTitleFontSize: 16,
    scheme: 'tableau10',
    labelDensity: 'low',
    padding: 24,
  },
};

/** Vega-Lite `config` block derived from the audience + colorblind flag. */
export function audienceConfig(
  audience: VizAudience,
  colorblind: boolean,
): Record<string, unknown> {
  const d = AUDIENCE_DEFAULTS[audience];
  return {
    font: 'Arial, Helvetica, sans-serif',
    padding: d.padding,
    title: {
      fontSize: d.titleFontSize,
      anchor: 'start',
      font: 'Arial, Helvetica, sans-serif',
    },
    axis: {
      labelFontSize: d.axisLabelFontSize,
      titleFontSize: d.axisTitleFontSize,
      labelFont: 'Arial, Helvetica, sans-serif',
      titleFont: 'Arial, Helvetica, sans-serif',
      grid: true,
    },
    legend: {
      labelFontSize: d.legendLabelFontSize,
      titleFontSize: d.legendTitleFontSize,
      labelFont: 'Arial, Helvetica, sans-serif',
      titleFont: 'Arial, Helvetica, sans-serif',
    },
    range: colorblind
      ? { category: { scheme: 'viridis' }, ramp: { scheme: 'viridis' } }
      : { category: { scheme: d.scheme } },
    view: { stroke: 'transparent' },
    background: 'white',
  };
}
