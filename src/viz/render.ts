import { parse as vegaParse, View, Warn } from 'vega';
import { compile } from 'vega-lite';
import type { TopLevelSpec } from 'vega-lite';

/**
 * Render a Vega-Lite spec to an SVG string using pure Node.js
 * (no canvas, no Puppeteer). Uses Vega's `renderer: 'none'` headless mode
 * followed by `view.toSVG()`.
 *
 * Post-processes the SVG to inject `paint-order="stroke"` on text elements
 * that specify both a fill and a stroke — see `ensureTextPaintOrder` below
 * for the rationale.
 */
export async function specToSvg(vlSpec: object): Promise<string> {
  const { spec: vgSpec } = compile(vlSpec as TopLevelSpec);
  const runtime = vegaParse(vgSpec);
  const view = new View(runtime, { renderer: 'none' });
  view.logLevel(Warn);
  const svg = await view.toSVG();
  view.finalize();
  return ensureTextPaintOrder(svg);
}

/**
 * Inject `paint-order="stroke"` on any `<text>` element that has both `fill`
 * and `stroke` attributes but is missing `paint-order`.
 *
 * Vega-Lite specs may set `paintOrder: 'stroke'` on a text mark to render a
 * contrasting halo (stroke drawn first, fill drawn on top) — this is the
 * standard trick for keeping cell labels legible over a colored heatmap.
 * However, `vega`'s Node-side SVG serializer (at least as of v5.30) does not
 * emit `paint-order` as an SVG attribute, so the halo collapses back to the
 * browser default (fill-then-stroke) and labels render as ghosted text.
 *
 * This post-processor adds the attribute back in. It's a no-op for text
 * elements that already have `paint-order`, or that don't have both fill and
 * stroke (so plain unstroked text is unaffected).
 */
export function ensureTextPaintOrder(svg: string): string {
  return svg.replace(/<text\b([^>]*)>/g, (match, attrs: string) => {
    if (/\bpaint-order\s*=/.test(attrs)) return match;
    if (!/\bfill\s*=/.test(attrs)) return match;
    if (!/\bstroke\s*=/.test(attrs)) return match;
    return `<text${attrs} paint-order="stroke">`;
  });
}

/**
 * Strip non-deterministic bits from SVG output (auto-generated ids,
 * clip-path urls) so that snapshot tests remain stable across runs.
 */
export function normalizeSvg(svg: string): string {
  return svg
    .replace(/id="[^"]*"/g, 'id="X"')
    .replace(/clip-path="url\(#[^)]+\)"/g, 'clip-path="url(#X)"')
    .replace(/xlink:href="#[^"]+"/g, 'xlink:href="#X"');
}
