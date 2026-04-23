import { Error as VegaError, parse as vegaParse, View, Warn } from 'vega';
import { compile } from 'vega-lite';
import type { TopLevelSpec } from 'vega-lite';
import PDFDocument from 'pdfkit';
import SVGtoPDF from 'svg-to-pdfkit';
import { rasterizeSvg } from './rasterize.js';

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
  // Empty-data specs legitimately trigger Vega "Infinite extent" warnings.
  // Keep those out of normal CLI/test stderr while preserving the full warning
  // stream for debugging sessions.
  view.logLevel(process.env.BBDATA_DEBUG ? Warn : VegaError);
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

/**
 * Render an SVG string into a single-page PDF buffer.
 *
 * Two modes:
 *  - `mode: 'vector'` (default) — embed the SVG directly via `svg-to-pdfkit`,
 *    producing a scalable vector PDF. Fastest, smallest file, prints crisp at
 *    any size. **Caveats:** `svg-to-pdfkit` has occasional rendering quirks
 *    with some Vega-Lite output (complex gradients used by our zone/heatmap
 *    color scales, `paint-order` on text halos, nested `clipPath`s). If a
 *    chart renders blank or misaligned, flip to `mode: 'raster'`.
 *  - `mode: 'raster'` — rasterize via `@resvg/resvg-js`, then wrap the PNG as
 *    a PDF image. Always visually correct (same pixels the PNG output uses),
 *    but the PDF is a raster image — zooming in blurs. `dpi` scales the
 *    intermediate raster (default 192 → 2× baseline, crisp on screen).
 *
 * Page size is the chart's declared SVG dimensions. PDF uses 72pt/inch, so
 * an 800×500 CSS-px SVG becomes an 800pt × 500pt page (~11"×7"). Dimensions
 * must be provided; we don't parse them out of the SVG string because
 * Vega-Lite occasionally emits CSS units we'd have to normalize.
 */
export async function specToPdf(
  svg: string,
  options: { width: number; height: number; mode?: 'vector' | 'raster'; dpi?: number },
): Promise<Buffer> {
  const { width, height, mode = 'vector', dpi = 192 } = options;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: [width, height], margin: 0 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    try {
      if (mode === 'raster') {
        // Render SVG → PNG at the requested dpi, then embed as a full-page image.
        // dpi/96 is the CSS→raster ratio (resvg treats CSS pixels as 96dpi).
        const rasterWidth = Math.max(1, Math.round(width * (dpi / 96)));
        const png = rasterizeSvg(svg, { width: rasterWidth });
        doc.image(png, 0, 0, { width, height });
      } else {
        // Vector embed. svg-to-pdfkit honors the width/height options by
        // scaling the SVG viewBox to fit the PDF page.
        SVGtoPDF(doc, svg, 0, 0, { width, height });
      }
      doc.end();
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

/**
 * Wrap an SVG string in a minimal standalone HTML document suitable for
 * drag-and-drop viewing in a browser or saving as `--format html`. The
 * embedded spec JSON is included as a `<script type="application/json">`
 * block so downstream tooling can re-extract the source spec without re-running
 * the CLI.
 */
export function specToHtml(
  svg: string,
  spec: object,
  options: { title?: string } = {},
): string {
  const title = options.title ?? 'bbdata chart';
  const escapedTitle = title.replace(/[<&]/g, (c) => (c === '<' ? '&lt;' : '&amp;'));
  const specJson = JSON.stringify(spec).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapedTitle}</title>
<style>
  body { margin: 0; padding: 24px; font-family: system-ui, -apple-system, sans-serif; background: #fff; }
  .chart { max-width: 100%; }
  .chart svg { max-width: 100%; height: auto; }
</style>
</head>
<body>
<div class="chart">${svg}</div>
<script type="application/json" id="bbdata-spec">${specJson}</script>
</body>
</html>
`;
}
