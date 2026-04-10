import { describe, it, expect } from 'vitest';
import { specToSvg, normalizeSvg } from '../../src/viz/render.js';

describe('specToSvg', () => {
  it('compiles a trivial Vega-Lite spec to SVG', async () => {
    const spec = {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      data: { values: [{ x: 1, y: 2 }, { x: 2, y: 3 }, { x: 3, y: 5 }] },
      mark: 'point',
      encoding: {
        x: { field: 'x', type: 'quantitative' },
        y: { field: 'y', type: 'quantitative' },
      },
    };
    const svg = await specToSvg(spec);
    expect(typeof svg).toBe('string');
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
  });

  it('handles an empty data array without crashing', async () => {
    const spec = {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      data: { values: [] },
      mark: 'point',
      encoding: {
        x: { field: 'x', type: 'quantitative' },
        y: { field: 'y', type: 'quantitative' },
      },
    };
    const svg = await specToSvg(spec);
    expect(svg).toContain('<svg');
  });
});

describe('normalizeSvg', () => {
  it('replaces auto-generated ids with a placeholder', () => {
    const input = '<svg><g id="abc123"><rect clip-path="url(#xyz)" /></g></svg>';
    const out = normalizeSvg(input);
    expect(out).toContain('id="X"');
    expect(out).toContain('clip-path="url(#X)"');
    expect(out).not.toContain('abc123');
    expect(out).not.toContain('xyz');
  });
});
