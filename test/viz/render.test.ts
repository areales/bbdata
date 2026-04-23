import { describe, it, expect, vi, afterEach } from 'vitest';
import { specToSvg, specToHtml, normalizeSvg, ensureTextPaintOrder } from '../../src/viz/render.js';

afterEach(() => {
  delete process.env.BBDATA_DEBUG;
});

describe('specToSvg', () => {
  it('compiles a trivial Vega-Lite spec to SVG', async () => {
    const spec = {
      $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
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
      $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
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

  it('suppresses expected Vega warnings for empty data in non-debug mode', async () => {
    delete process.env.BBDATA_DEBUG;
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const spec = {
      $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
      data: { values: [] },
      mark: 'point',
      encoding: {
        x: { field: 'x', type: 'quantitative' },
        y: { field: 'y', type: 'quantitative' },
      },
    };

    await specToSvg(spec);
    expect(warnSpy).not.toHaveBeenCalled();
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

describe('specToHtml', () => {
  it('wraps the svg in a standalone HTML document with the spec embedded', () => {
    const svg = '<svg data-test="demo"></svg>';
    const spec = { $schema: 'foo', data: { values: [] } };
    const html = specToHtml(svg, spec, { title: 'Demo' });
    expect(html).toMatch(/^<!doctype html>/);
    expect(html).toContain('<title>Demo</title>');
    expect(html).toContain('<svg data-test="demo"></svg>');
    expect(html).toContain('<script type="application/json" id="bbdata-spec">');
    expect(html).toContain('"$schema":"foo"');
  });

  it('escapes tags inside embedded spec JSON', () => {
    const html = specToHtml('<svg/>', { danger: '</script><script>x()' });
    expect(html).not.toContain('</script><script>x()');
    expect(html).toContain('\\u003c/script');
  });

  it('uses a default title when none provided', () => {
    const html = specToHtml('<svg/>', {});
    expect(html).toContain('<title>bbdata chart</title>');
  });
});

describe('specToSvg end-to-end paint-order fix', () => {
  it('emits paint-order="stroke" on a text mark that sets paintOrder', async () => {
    const spec = {
      $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
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
