import { parse as vegaParse, View, Warn } from 'vega';
import { compile } from 'vega-lite';
import type { TopLevelSpec } from 'vega-lite';

/**
 * Render a Vega-Lite spec to an SVG string using pure Node.js
 * (no canvas, no Puppeteer). Uses Vega's `renderer: 'none'` headless mode
 * followed by `view.toSVG()`.
 */
export async function specToSvg(vlSpec: object): Promise<string> {
  const { spec: vgSpec } = compile(vlSpec as TopLevelSpec);
  const runtime = vegaParse(vgSpec);
  const view = new View(runtime, { renderer: 'none' });
  view.logLevel(Warn);
  const svg = await view.toSVG();
  view.finalize();
  return svg;
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
