import type { VizAudience, VizTheme } from './types.js';
import { THEMES, categoricalRange } from './theme.js';

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

const FONT = 'Arial, Helvetica, sans-serif';

/**
 * Vega-Lite `config` block derived from the audience and the theme.
 *
 * The audience decides sizes (canvas, type scale); the theme decides every
 * color that isn't data: surface, ink, hairline grid, axis lines, and the
 * categorical range. Gridlines are solid hairlines one step off the surface
 * so the data is the only loud thing on the canvas. `--colorblind` no longer
 * swaps the palette for viridis — the palette is CVD-validated as shipped,
 * and the charts add shape as a redundant channel instead (see theme.ts).
 */
export function audienceConfig(
  audience: VizAudience,
  colorblindOrOptions: boolean | { colorblind?: boolean; theme?: VizTheme },
): Record<string, unknown> {
  const opts =
    typeof colorblindOrOptions === 'boolean'
      ? { colorblind: colorblindOrOptions, theme: 'light' as VizTheme }
      : colorblindOrOptions;
  const theme: VizTheme = opts.theme ?? 'light';
  const t = THEMES[theme];
  const d = AUDIENCE_DEFAULTS[audience];
  return {
    font: FONT,
    padding: d.padding,
    background: t.surface,
    title: {
      fontSize: d.titleFontSize,
      anchor: 'start',
      font: FONT,
      color: t.ink,
      subtitleColor: t.muted,
      subtitleFontSize: Math.max(10, d.axisTitleFontSize - 1),
      subtitlePadding: 4,
      offset: 12,
    },
    axis: {
      labelFontSize: d.axisLabelFontSize,
      titleFontSize: d.axisTitleFontSize,
      labelFont: FONT,
      titleFont: FONT,
      labelColor: t.muted,
      titleColor: t.muted,
      grid: true,
      gridColor: t.grid,
      gridWidth: 1,
      domainColor: t.axis,
      tickColor: t.axis,
      titlePadding: 8,
    },
    legend: {
      labelFontSize: d.legendLabelFontSize,
      titleFontSize: d.legendTitleFontSize,
      labelFont: FONT,
      titleFont: FONT,
      labelColor: t.ink,
      titleColor: t.muted,
      symbolSize: 80,
    },
    // Facet headers (the "AVG" / "SLG" panel labels on rolling and
    // comparison) are their own config block in Vega-Lite. Left unset they
    // stay at the 10px default at every audience, which is why a coach-size
    // comparison used to look like a scaled-down analyst one.
    header: {
      labelFontSize: d.axisTitleFontSize,
      titleFontSize: d.axisTitleFontSize,
      labelFont: FONT,
      titleFont: FONT,
      labelColor: t.ink,
      titleColor: t.muted,
    },
    text: { color: t.ink, font: FONT },
    range: {
      category: categoricalRange(theme),
      ramp: t.sequential,
    },
    view: { stroke: 'transparent' },
  };
}
