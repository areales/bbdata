import { describe, it, expect } from 'vitest';
import { specToSvg, normalizeSvg, ensureTextPaintOrder } from '../../src/viz/render.js';

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

describe('ensureTextPaintOrder', () => {
  it('injects paint-order="stroke" on text with both fill and stroke', () => {
    const input =
      '<svg><text fill="black" stroke="white" stroke-width="3">0.524</text></svg>';
    const out = ensureTextPaintOrder(input);
    expect(out).toContain('paint-order="stroke"');
    expect(out).toContain('<text fill="black" stroke="white" stroke-width="3" paint-order="stroke">');
  });

  it('is a no-op when paint-order is already present', () => {
    const input =
      '<svg><text fill="black" stroke="white" paint-order="stroke">hi</text></svg>';
    const out = ensureTextPaintOrder(input);
    expect(out).toBe(input);
  });

  it('leaves unstroked text alone', () => {
    const input = '<svg><text fill="black">plain</text></svg>';
    const out = ensureTextPaintOrder(input);
    expect(out).toBe(input);
  });

  it('leaves unfilled text alone', () => {
    const input = '<svg><text stroke="white">odd</text></svg>';
    const out = ensureTextPaintOrder(input);
    expect(out).toBe(input);
  });

  it('handles multiple text elements in one svg', () => {
    const input =
      '<svg>' +
      '<text fill="black" stroke="white">a</text>' +
      '<text fill="red">b</text>' +
      '<text fill="black" stroke="white">c</text>' +
      '</svg>';
    const out = ensureTextPaintOrder(input);
    const matches = out.match(/paint-order="stroke"/g) ?? [];
    expect(matches.length).toBe(2);
  });
});

describe('specToSvg end-to-end paint-order fix', () => {
  it('emits paint-order="stroke" on a text mark that sets paintOrder', async () => {
    const spec = {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      data: { values: [{ x: 1, y: 1, label: '0.524' }] },
      mark: {
        type: 'text',
        fontSize: 18,
        fontWeight: 'bold',
        stroke: 'white',
        strokeWidth: 3,
        paintOrder: 'stroke',
      },
      encoding: {
        x: { field: 'x', type: 'quantitative' },
        y: { field: 'y', type: 'quantitative' },
        text: { field: 'label', type: 'nominal' },
        color: { value: 'black' },
      },
    };
    const svg = await specToSvg(spec);
    // The regression: Vega's SVG serializer drops paintOrder, so without the
    // post-process the text element would be missing this attribute entirely.
    expect(svg).toMatch(/<text[^>]*paint-order="stroke"[^>]*>/);
    expect(svg).toContain('0.524');
  });
});
