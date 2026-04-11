/**
 * Extract and rasterize inline SVG blocks from a bbdata report markdown file.
 *
 * The bbdata report command embeds chart SVGs directly into the rendered
 * markdown (see `src/viz/embed.ts`). For iterative preview work — and so the
 * assistant can "see" charts via the Read tool — this script pulls each
 * `<svg>...</svg>` block out of a `.reports/<report>.md` file and writes an
 * adjacent PNG per chart at `.reports/<report>-chart-<N>.png`.
 *
 * Uses the same `rasterizeSvg` helper that `render-fixtures.ts` uses, so the
 * PNG defaults (white background, 1600px width for crisp text) are consistent
 * with the existing visual test harness.
 *
 * Usage:
 *   tsx scripts/extract-report-assets.ts <relative-path-under-.reports>
 *
 * Example:
 *   tsx scripts/extract-report-assets.ts pro-hitter-eval_judge_2025.md
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { rasterizeSvg } from '../test/helpers/rasterize.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');
const REPORTS_DIR = resolve(REPO_ROOT, '.reports');

function extractSvgBlocks(markdown: string): string[] {
  // Match <svg ...>...</svg> non-greedy, with the `s` flag so `.` spans newlines.
  const regex = /<svg[\s\S]*?<\/svg>/g;
  return markdown.match(regex) ?? [];
}

function main(): void {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: tsx scripts/extract-report-assets.ts <file.md>');
    process.exit(1);
  }

  const mdPath = resolve(REPORTS_DIR, arg);
  const markdown = readFileSync(mdPath, 'utf8');
  const svgs = extractSvgBlocks(markdown);

  if (svgs.length === 0) {
    console.log(`No <svg> blocks found in ${arg}`);
    return;
  }

  const stem = basename(mdPath, extname(mdPath));
  console.log(`Found ${svgs.length} SVG block(s) in ${arg}. Rasterizing...\n`);

  svgs.forEach((svg, i) => {
    const pngPath = resolve(REPORTS_DIR, `${stem}-chart-${i + 1}.png`);
    const png = rasterizeSvg(svg, { width: 1600 });
    writeFileSync(pngPath, png);
    const kb = (png.byteLength / 1024).toFixed(1);
    console.log(`  chart ${i + 1}: ${kb.padStart(6)} KB  →  ${basename(pngPath)}`);
  });

  console.log(`\nDone. Read the PNGs in .reports/ to inspect visually.`);
}

main();
