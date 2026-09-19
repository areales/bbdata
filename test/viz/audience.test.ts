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

  it('keeps the validated palette under --colorblind (shape is the redundant channel, not viridis)', () => {
    const plain = audienceConfig('coach', false) as { range: { category: string[] } };
    const cb = audienceConfig('coach', true) as { range: { category: string[] } };
    expect(cb.range.category).toEqual(plain.range.category);
    expect(plain.range.category[0]).toBe('#2a78d6');
  });

  it('derives surface, ink, and grid tokens from the theme', () => {
    type Cfg = { background: string; axis: { gridColor: string; labelColor: string }; range: { category: string[]; ramp: string[] } };
    const light = audienceConfig('analyst', { theme: 'light' }) as Cfg;
    const dark = audienceConfig('analyst', { theme: 'dark' }) as Cfg;
    const print = audienceConfig('analyst', { theme: 'print' }) as Cfg;
    expect(light.background).toBe('#ffffff');
    expect(dark.background).toBe('#1a1a19');
    expect(dark.axis.gridColor).not.toBe(light.axis.gridColor);
    // Print is grayscale: every categorical slot is a neutral (r == g == b).
    for (const hex of print.range.category) {
      expect(hex).toMatch(/^#([0-9a-f]{2})\1\1$/i);
    }
    expect(light.range.ramp).toHaveLength(7);
  });

  it('a bare boolean second argument still means { colorblind } on the light theme', () => {
    const a = audienceConfig('analyst', false) as { background: string };
    const b = audienceConfig('analyst', { colorblind: false, theme: 'light' }) as { background: string };
    expect(a).toEqual(b);
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

  it('rejects unknown audience values with the accepted list (P4.8 regression)', () => {
    // "bogus" used to silently coerce to analyst styling.
    expect(() => resolveVizAudience('bogus' as never)).toThrow(
      /Unknown --audience "bogus".*coach, analyst, frontoffice, presentation/,
    );
  });
});
