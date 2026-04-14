import { Resvg } from '@resvg/resvg-js';

/**
 * Rasterize an SVG string to a PNG buffer. Thin wrapper around `@resvg/resvg-js`.
 *
 * Used by the CLI (`viz --format png`), `scripts/render-fixtures.ts`, and
 * `scripts/extract-report-assets.ts` to produce human-inspectable PNGs of
 * shipped chart types.
 *
 * Defaults are tuned for the assistant's workflow of reading the PNGs back
 * via the Read tool:
 *  - `background: white` — SVG chart backgrounds are transparent, which
 *    renders as a checkerboard in most viewers and makes dark axis labels
 *    invisible against a dark VS Code theme. White is what the markdown
 *    preview embeds the SVG onto anyway.
 *  - `fitTo: width = 1600` — 2x the typical 800px chart width, so text is
 *    crisp when rendered at normal PNG viewers.
 */
export interface RasterizeOptions {
  /** Target width in CSS pixels. Height scales proportionally. Default 1600. */
  width?: number;
  /** Background color. Default '#ffffff'. */
  background?: string;
}

export function rasterizeSvg(svg: string, opts: RasterizeOptions = {}): Buffer {
  const { width = 1600, background = '#ffffff' } = opts;
  const resvg = new Resvg(svg, {
    background,
    fitTo: { mode: 'width', value: width },
    font: { loadSystemFonts: true },
  });
  const rendered = resvg.render();
  return rendered.asPng();
}
