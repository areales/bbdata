import type { ChartBuilder, ResolvedVizOptions } from '../types.js';
import { audienceConfig, AUDIENCE_DEFAULTS } from '../audience.js';
import { THEMES, formatRate } from '../theme.js';
import { zoneCells } from './zone.js';

/**
 * Zone Profile — ranked bars
 *
 * The same nine `hitter-zone-grid` cells as `zone`, drawn as horizontal bars
 * sorted by xwOBA. The heatmap is for pattern (where is he hot); this is for
 * exact comparison (how much hotter is middle-in than low-away), which a
 * written report needs and a color ramp can't deliver. Both share the data
 * requirement so a report can embed either from one fetch.
 */
export const zoneRankedBuilder: ChartBuilder = {
  id: 'zone-ranked',

  dataRequirements: [
    { queryTemplate: 'hitter-zone-grid', required: true },
  ],

  defaultTitle({ player, season }) {
    return `${player} — Zone Profile, xwOBA by region (${season})`;
  },

  buildSpec(rows, options: ResolvedVizOptions) {
    const cells = zoneCells(rows)
      .slice()
      .sort((a, b) => b.xwoba - a.xwoba)
      .map((c) => ({ ...c, label: formatRate(c.xwoba), sub: `${c.pa} PA` }));
    const t = THEMES[options.theme];
    const d = AUDIENCE_DEFAULTS[options.audience];
    const order = cells.map((c) => c.zone);
    const max = Math.max(0.5, ...cells.map((c) => c.xwoba));
    const domainMax = Number((Math.ceil(max / 0.05) * 0.05).toFixed(2));
    const totalPa = cells.reduce((a, c) => a + c.pa, 0);

    // Bars ≤ 24px thick; the band's leftover is air.
    const barBand = Math.min(24 + d.axisLabelFontSize, Math.floor(options.height / Math.max(1, cells.length)));
    const height = barBand * cells.length;

    return {
      $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
      title: {
        text: options.title,
        subtitle: `Sorted high → low · ${totalPa} PA · catcher's view`,
      },
      width: options.width,
      height,
      data: { values: cells },
      layer: [
        {
          mark: { type: 'bar', cornerRadiusEnd: 4, color: t.accent },
          encoding: {
            y: {
              field: 'zone',
              type: 'nominal',
              sort: order,
              axis: { title: null, labelPadding: 8, domain: false, ticks: false, grid: false },
              scale: { paddingInner: 0.35, paddingOuter: 0.1 },
            },
            x: {
              field: 'xwoba',
              type: 'quantitative',
              scale: { domain: [0, domainMax], nice: false },
              axis: {
                title: 'xwOBA',
                tickCount: 4,
                labelExpr: "datum.value === 0 ? '0' : replace(format(datum.value, '.2f'), /^0\\./, '.')",
                domain: false,
              },
            },
            tooltip: [
              { field: 'zone', title: 'Zone' },
              { field: 'pitches', title: 'Pitches' },
              { field: 'pa', title: 'PAs' },
              { field: 'xwoba', title: 'xwOBA', format: '.3f' },
            ],
          },
        },
        {
          // Value at the tip, PA count after it in the muted ink.
          mark: { type: 'text', align: 'left', dx: 6, fontWeight: 'bold', fontSize: d.axisLabelFontSize },
          encoding: {
            y: { field: 'zone', type: 'nominal', sort: order },
            x: { field: 'xwoba', type: 'quantitative' },
            text: { field: 'label', type: 'nominal' },
            color: { value: t.ink },
          },
        },
        {
          mark: {
            type: 'text',
            align: 'left',
            dx: 6 + Math.round(d.axisLabelFontSize * 2.6),
            fontSize: Math.max(9, d.axisLabelFontSize - 2),
          },
          encoding: {
            y: { field: 'zone', type: 'nominal', sort: order },
            x: { field: 'xwoba', type: 'quantitative' },
            text: { field: 'sub', type: 'nominal' },
            color: { value: t.muted },
          },
        },
      ],
      config: {
        ...audienceConfig(options.audience, { colorblind: options.colorblind, theme: options.theme }),
        // Room for the tip labels past the longest bar.
        padding: { left: d.padding, top: d.padding, bottom: d.padding, right: d.padding + Math.round(d.axisLabelFontSize * 5) },
      },
    };
  },
};
