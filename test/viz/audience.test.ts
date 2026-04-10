import { describe, it, expect } from 'vitest';
import { AUDIENCE_DEFAULTS, audienceConfig } from '../../src/viz/audience.js';
import { resolveVizAudience } from '../../src/viz/types.js';

describe('AUDIENCE_DEFAULTS', () => {
  it('defines all four viz audiences', () => {
    expect(AUDIENCE_DEFAULTS).toHaveProperty('coach');
    expect(AUDIENCE_DEFAULTS).toHaveProperty('analyst');
    expect(AUDIENCE_DEFAULTS).toHaveProperty('frontoffice');
    expect(AUDIENCE_DEFAULTS).toHaveProperty('presentation');
  });

  it('coach audience has the largest font sizes', () => {
    expect(AUDIENCE_DEFAULTS.coach.titleFontSize).toBeGreaterThanOrEqual(20);
    expect(AUDIENCE_DEFAULTS.coach.axisLabelFontSize).toBeGreaterThanOrEqual(16);
  });

  it('presentation has the largest dimensions', () => {
    expect(AUDIENCE_DEFAULTS.presentation.width).toBeGreaterThanOrEqual(
      AUDIENCE_DEFAULTS.analyst.width,
    );
  });
});

describe('audienceConfig', () => {
  it('returns a Vega-Lite config block with title/axis/legend', () => {
    const cfg = audienceConfig('analyst', false) as {
      title: { fontSize: number };
      axis: { labelFontSize: number };
      legend: { labelFontSize: number };
    };
    expect(cfg.title.fontSize).toBe(AUDIENCE_DEFAULTS.analyst.titleFontSize);
    expect(cfg.axis.labelFontSize).toBe(AUDIENCE_DEFAULTS.analyst.axisLabelFontSize);
    expect(cfg.legend.labelFontSize).toBe(AUDIENCE_DEFAULTS.analyst.legendLabelFontSize);
  });

  it('forces viridis palette when colorblind is true', () => {
    const cfg = audienceConfig('coach', true) as {
      range: { category: { scheme: string }; ramp: { scheme: string } };
    };
    expect(cfg.range.category.scheme).toBe('viridis');
    expect(cfg.range.ramp.scheme).toBe('viridis');
  });
});

describe('resolveVizAudience', () => {
  it('maps gm → frontoffice', () => {
    expect(resolveVizAudience('gm')).toBe('frontoffice');
  });

  it('maps scout → analyst', () => {
    expect(resolveVizAudience('scout')).toBe('analyst');
  });

  it('passes through viz audiences unchanged', () => {
    expect(resolveVizAudience('coach')).toBe('coach');
    expect(resolveVizAudience('analyst')).toBe('analyst');
    expect(resolveVizAudience('frontoffice')).toBe('frontoffice');
    expect(resolveVizAudience('presentation')).toBe('presentation');
  });

  it('defaults to analyst when undefined', () => {
    expect(resolveVizAudience(undefined)).toBe('analyst');
  });
});
