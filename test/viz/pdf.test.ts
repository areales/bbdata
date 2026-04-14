/**
 * End-to-end PDF output tests. Renders each shipped chart type to PDF via
 * both the vector (svg-to-pdfkit) and raster (resvg → pdf image) paths,
 * then asserts the output starts with the PDF magic bytes and is non-trivial
 * in size.
 *
 * Font/system init on resvg's first call can be 5–10s on Windows, so the
 * raster tests share a suite-level timeout bump. Vector tests are fast.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { movementBuilder } from '../../src/viz/charts/movement.js';
import { sprayBuilder } from '../../src/viz/charts/spray.js';
import { zoneBuilder } from '../../src/viz/charts/zone.js';
import { rollingBuilder } from '../../src/viz/charts/rolling.js';
import { specToSvg, specToPdf } from '../../src/viz/render.js';
import type { ChartBuilder, ResolvedVizOptions } from '../../src/viz/types.js';

const __filename = fileURLToPath(import.meta.url);
const FIXTURES_DIR = resolve(dirname(__filename), '../fixtures/viz');

function loadFixture(filename: string): Record<string, unknown>[] {
  const raw = readFileSync(resolve(FIXTURES_DIR, filename), 'utf8');
  const parsed = JSON.parse(raw) as { data?: Record<string, unknown>[] };
  return parsed.data ?? [];
}

function baseOpts(overrides: Partial<ResolvedVizOptions> = {}): ResolvedVizOptions {
  return {
    type: 'movement',
    player: 'Demo',
    season: 2025,
    audience: 'analyst',
    format: 'pdf',
    width: 800,
    height: 500,
    colorblind: false,
    title: 'Demo Chart',
    ...overrides,
  };
}

interface PdfCase {
  name: string;
  builder: ChartBuilder;
  fixture: string;
  queryKey: string;
  opts?: Partial<ResolvedVizOptions>;
}

const CASES: PdfCase[] = [
  { name: 'movement', builder: movementBuilder, fixture: 'raw-pitches.sample.json', queryKey: 'pitcher-raw-pitches' },
  { name: 'spray', builder: sprayBuilder, fixture: 'raw-bip.sample.json', queryKey: 'hitter-raw-bip' },
  { name: 'zone', builder: zoneBuilder, fixture: 'zone-grid.sample.json', queryKey: 'hitter-zone-grid', opts: { width: 520, height: 520 } },
  { name: 'rolling', builder: rollingBuilder, fixture: 'rolling-windows.sample.json', queryKey: 'trend-rolling-average', opts: { width: 720, height: 360 } },
];

function assertLooksLikePdf(buf: Buffer, minBytes = 1024): void {
  expect(Buffer.isBuffer(buf)).toBe(true);
  expect(buf.byteLength).toBeGreaterThan(minBytes);
  // PDF magic bytes: %PDF-1.x
  expect(buf.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  // EOF marker somewhere in the last ~64 bytes
  const tail = buf.subarray(Math.max(0, buf.byteLength - 64)).toString('ascii');
  expect(tail).toMatch(/%%EOF/);
}

describe('specToPdf — vector mode (svg-to-pdfkit)', () => {
  for (const c of CASES) {
    it(`renders ${c.name} chart to a valid PDF`, async () => {
      const rows = { [c.queryKey]: loadFixture(c.fixture) };
      const options = baseOpts({ type: c.name as ResolvedVizOptions['type'], ...c.opts });
      const spec = c.builder.buildSpec(rows, options);
      const svg = await specToSvg(spec);
      const pdf = await specToPdf(svg, { width: options.width, height: options.height, mode: 'vector' });
      assertLooksLikePdf(pdf);
    });
  }
});

// Raster mode hits resvg which does a slow first-call font init on Windows.
describe('specToPdf — raster mode (resvg + pdfkit image)', { timeout: 30_000 }, () => {
  it('renders a movement chart to a valid PDF at default dpi', async () => {
    const rows = { 'pitcher-raw-pitches': loadFixture('raw-pitches.sample.json') };
    const options = baseOpts();
    const spec = movementBuilder.buildSpec(rows, options);
    const svg = await specToSvg(spec);
    const pdf = await specToPdf(svg, { width: options.width, height: options.height, mode: 'raster' });
    assertLooksLikePdf(pdf);
  });

  it('produces a larger PDF at higher dpi', async () => {
    const rows = { 'pitcher-raw-pitches': loadFixture('raw-pitches.sample.json') };
    const options = baseOpts();
    const spec = movementBuilder.buildSpec(rows, options);
    const svg = await specToSvg(spec);
    const low = await specToPdf(svg, { width: options.width, height: options.height, mode: 'raster', dpi: 72 });
    const high = await specToPdf(svg, { width: options.width, height: options.height, mode: 'raster', dpi: 300 });
    assertLooksLikePdf(low);
    assertLooksLikePdf(high);
    expect(high.byteLength).toBeGreaterThan(low.byteLength);
  });
});
