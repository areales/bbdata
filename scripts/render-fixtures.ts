/**
 * Fixture renderer for the visual test harness.
 *
 * For each chart type in bbdata, loads the corresponding JSON fixture from
 * `test/fixtures/viz/`, calls the chart builder directly, renders the
 * Vega-Lite spec to SVG via `specToSvg`, rasterizes the SVG to PNG via
 * `@resvg/resvg-js`, and writes both artifacts into `.reports/fixtures/`.
 *
 * This is the loop that lets the assistant "see" charts: the PNGs in
 * `.reports/fixtures/` can be inspected with the Read tool the same way
 * Aaron inspects them in VS Code markdown preview. Running this script
 * is also the recommended last-step sanity check before an npm release.
 *
 * Usage:
 *   npm run viz:fixtures
 *
 * Does NOT touch personal reports in `.reports/*.md` — only writes to the
 * dedicated `.reports/fixtures/` subdirectory.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { movementBuilder } from '../src/viz/charts/movement.js';
import { movementBinnedBuilder } from '../src/viz/charts/movement-binned.js';
import { sprayBuilder } from '../src/viz/charts/spray.js';
import { zoneBuilder } from '../src/viz/charts/zone.js';
import { rollingBuilder } from '../src/viz/charts/rolling.js';
import { pitcherRollingBuilder } from '../src/viz/charts/pitcher-rolling.js';
import { specToSvg } from '../src/viz/render.js';
import type { ChartBuilder, ResolvedVizOptions } from '../src/viz/types.js';
import { rasterizeSvg } from '../src/viz/rasterize.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');
const FIXTURES_DIR = resolve(REPO_ROOT, 'test/fixtures/viz');
const OUTPUT_DIR = resolve(REPO_ROOT, '.reports/fixtures');

interface ChartFixture {
  /** Chart type (used for output filenames) */
  type: 'movement' | 'movement-binned' | 'spray' | 'zone' | 'rolling' | 'pitcher-rolling';
  /** Chart builder to invoke */
  builder: ChartBuilder;
  /** Query template id the builder reads rows from */
  queryKey: string;
  /** JSON fixture file (relative to test/fixtures/viz) */
  fixture: string;
  /** Player name used in the chart title */
  player: string;
  /** ResolvedVizOptions overrides for this chart type */
  overrides?: Partial<ResolvedVizOptions>;
}

export const FIXTURES: ChartFixture[] = [
  {
    type: 'movement',
    builder: movementBuilder,
    queryKey: 'pitcher-raw-pitches',
    fixture: 'raw-pitches.sample.json',
    player: 'Demo Pitcher',
  },
  {
    // Full-season payload (551 pitches) rather than the 6-pitch
    // raw-pitches sample — the binned density variant exists for exactly
    // this data volume, and a handful of pitches renders a misleadingly
    // empty grid.
    type: 'movement-binned',
    builder: movementBinnedBuilder,
    queryKey: 'pitcher-raw-pitches',
    fixture: 'season-pitches.sample.json',
    player: 'Demo Pitcher',
  },
  {
    type: 'spray',
    builder: sprayBuilder,
    queryKey: 'hitter-raw-bip',
    fixture: 'raw-bip.sample.json',
    player: 'Demo Hitter',
  },
  {
    type: 'zone',
    builder: zoneBuilder,
    queryKey: 'hitter-zone-grid',
    fixture: 'zone-grid.sample.json',
    player: 'Demo Hitter',
    overrides: { width: 520, height: 520 },
  },
  {
    type: 'rolling',
    builder: rollingBuilder,
    queryKey: 'trend-rolling-average',
    fixture: 'rolling-windows.sample.json',
    player: 'Demo Hitter',
    overrides: { width: 720, height: 360 },
  },
  {
    // Taller than the hitter rolling chart — this one facets four metric
    // panels (Avg Velo / Whiff % / K % / CSW %) instead of two.
    type: 'pitcher-rolling',
    builder: pitcherRollingBuilder,
    queryKey: 'pitcher-rolling-trend',
    fixture: 'pitcher-rolling-windows.sample.json',
    player: 'Demo Pitcher',
    overrides: { width: 720, height: 520 },
  },
];

function baseOptions(
  type: ResolvedVizOptions['type'],
  player: string,
  overrides: Partial<ResolvedVizOptions> = {},
): ResolvedVizOptions {
  return {
    type,
    player,
    season: 2025,
    audience: 'analyst',
    format: 'svg',
    width: 800,
    height: 500,
    colorblind: false,
    title: `${player} — ${titleCase(type)} Chart (Fixture)`,
    ...overrides,
  };
}

function titleCase(s: string): string {
  return s[0]!.toUpperCase() + s.slice(1);
}

function loadFixture(filename: string): Record<string, unknown>[] {
  const full = resolve(FIXTURES_DIR, filename);
  const raw = readFileSync(full, 'utf8');
  const parsed = JSON.parse(raw) as { data?: Record<string, unknown>[] } | Record<string, unknown>[];
  if (Array.isArray(parsed)) return parsed;
  return parsed.data ?? [];
}

async function main(): Promise<void> {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log(`Rendering ${FIXTURES.length} fixtures → ${OUTPUT_DIR}\n`);

  for (const fx of FIXTURES) {
    const rows = { [fx.queryKey]: loadFixture(fx.fixture) };
    const options = baseOptions(fx.type, fx.player, fx.overrides);
    const spec = fx.builder.buildSpec(rows, options);
    const svg = await specToSvg(spec);
    const png = rasterizeSvg(svg, { width: 1200 });

    const svgPath = resolve(OUTPUT_DIR, `${fx.type}.svg`);
    const pngPath = resolve(OUTPUT_DIR, `${fx.type}.png`);
    writeFileSync(svgPath, svg);
    writeFileSync(pngPath, png);

    const rowCount = rows[fx.queryKey]!.length;
    console.log(
      `  ${fx.type.padEnd(10)} ${rowCount.toString().padStart(3)} rows  →  ${fx.type}.svg + ${fx.type}.png`,
    );
  }

  console.log(`\nDone. Read ${OUTPUT_DIR}/<type>.png to inspect visually.`);
}

// Only render when executed directly (npm run viz:fixtures) — the FIXTURES
// list is also imported by test/scripts/render-fixtures.test.ts, which must
// not trigger a full render pass.
const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (invokedPath === __filename) {
  main().catch((err) => {
    console.error('render-fixtures failed:', err);
    process.exit(1);
  });
}
