/**
 * End-to-end snapshot + structural tests for the four chart builders.
 *
 * Each test:
 *   1. Loads a JSON fixture from `test/fixtures/viz/`
 *   2. Passes it through the chart builder's `buildSpec`
 *   3. Renders the Vega-Lite spec to SVG via `specToSvg`
 *   4. Normalizes the SVG (strip non-deterministic ids) and snapshots it
 *   5. Runs explicit structural assertions that catch the specific bugs
 *      we've hit in the past — paint-order on zone cell labels, title
 *      text, axis titles, viewBox presence, etc.
 *
 * The snapshot catches broad structural regressions ("the SVG suddenly
 * looks different"). The explicit assertions catch narrow, known-important
 * invariants that would be easy to miss in a large diff.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { movementBuilder } from '../../src/viz/charts/movement.js';
import { sprayBuilder } from '../../src/viz/charts/spray.js';
import { zoneBuilder } from '../../src/viz/charts/zone.js';
import { rollingBuilder } from '../../src/viz/charts/rolling.js';
import { specToSvg, normalizeSvg } from '../../src/viz/render.js';
import type { ResolvedVizOptions } from '../../src/viz/types.js';

const __filename = fileURLToPath(import.meta.url);
const FIXTURES_DIR = resolve(dirname(__filename), '../fixtures/viz');

function loadFixture(filename: string): Record<string, unknown>[] {
  const raw = readFileSync(resolve(FIXTURES_DIR, filename), 'utf8');
  const parsed = JSON.parse(raw) as { data?: Record<string, unknown>[] };
  return parsed.data ?? [];
}

function opts(overrides: Partial<ResolvedVizOptions> = {}): ResolvedVizOptions {
  return {
    type: 'movement',
    player: 'Demo Player',
    season: 2025,
    audience: 'analyst',
    format: 'svg',
    width: 800,
    height: 500,
    colorblind: false,
    title: 'Demo Chart',
    ...overrides,
  };
}

// Extract all `<text ...>text</text>` element opening-tag attribute strings
// and their text content from an SVG string. Deliberately simple — Vega's
// SVG output puts each <text> opening tag on a single line with stable
// attribute ordering, so a regex is safe and zero-dep.
interface ParsedText {
  attrs: string;
  content: string;
}
function extractTextElements(svg: string): ParsedText[] {
  const out: ParsedText[] = [];
  const re = /<text\b([^>]*)>([^<]*)<\/text>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(svg)) !== null) {
    out.push({ attrs: m[1] ?? '', content: m[2] ?? '' });
  }
  return out;
}

describe('zone chart — snapshot + structural', () => {
  const rows = { 'hitter-zone-grid': loadFixture('zone-grid.sample.json') };
  const options = opts({
    type: 'zone',
    title: 'Demo Hitter — Zone Profile, xwOBA (2025)',
    width: 520,
    height: 520,
  });

  it('matches normalized SVG snapshot', async () => {
    const spec = zoneBuilder.buildSpec(rows, options);
    const svg = await specToSvg(spec);
    expect(normalizeSvg(svg)).toMatchSnapshot();
  });

  it('cell labels carry paint-order="stroke" (regression test for readability bug)', async () => {
    const spec = zoneBuilder.buildSpec(rows, options);
    const svg = await specToSvg(spec);
    const texts = extractTextElements(svg);

    // Any text element with stroke="white" is a cell label and MUST have
    // the paint-order attribute — otherwise the halo collapses behind the
    // fill and the labels become ghosted-illegible on the red cells.
    const haloedLabels = texts.filter((t) => /stroke="white"/.test(t.attrs));
    expect(haloedLabels.length).toBeGreaterThan(0);
    for (const t of haloedLabels) {
      expect(t.attrs).toContain('paint-order="stroke"');
    }
  });

  it('cell label text content matches fixture xwOBA values to 3 decimals', async () => {
    const spec = zoneBuilder.buildSpec(rows, options);
    const svg = await specToSvg(spec);
    const texts = extractTextElements(svg);
    const labelContents = new Set(
      texts.filter((t) => /stroke="white"/.test(t.attrs)).map((t) => t.content),
    );

    // Fixture is test/fixtures/viz/zone-grid.sample.json
    const expected = ['0.524', '0.602', '0.373', '0.705', '0.650', '0.473', '0.391', '0.339', '0.190'];
    for (const v of expected) {
      expect(labelContents).toContain(v);
    }
  });

  it('uses the non-colorblind redyellowblue scheme with domain [0.2, 0.5] and clamp', () => {
    const spec = zoneBuilder.buildSpec(rows, options) as {
      layer: Array<{ encoding?: { color?: { scale?: Record<string, unknown> } } }>;
    };
    const rectLayer = spec.layer[0];
    const scale = rectLayer?.encoding?.color?.scale;
    expect(scale).toMatchObject({
      scheme: 'redyellowblue',
      reverse: true,
      domain: [0.2, 0.5],
      clamp: true,
    });
  });
});

describe('movement chart — snapshot + structural', () => {
  const rows = { 'pitcher-raw-pitches': loadFixture('raw-pitches.sample.json') };
  const options = opts({
    type: 'movement',
    title: 'Demo Pitcher — Pitch Movement (2025)',
  });

  it('matches normalized SVG snapshot', async () => {
    const spec = movementBuilder.buildSpec(rows, options);
    const svg = await specToSvg(spec);
    expect(normalizeSvg(svg)).toMatchSnapshot();
  });

  it('contains the chart title, both axis titles, and the Pitch legend', async () => {
    const spec = movementBuilder.buildSpec(rows, options);
    const svg = await specToSvg(spec);
    expect(svg).toContain('Demo Pitcher — Pitch Movement (2025)');
    expect(svg).toContain('Horizontal Break');
    expect(svg).toContain('Induced Vertical Break');
    expect(svg).toContain('Pitch');
  });

  it('has a non-zero viewBox on the root svg', async () => {
    const spec = movementBuilder.buildSpec(rows, options);
    const svg = await specToSvg(spec);
    const match = svg.match(/<svg[^>]*viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/);
    expect(match).not.toBeNull();
    expect(parseFloat(match![1]!)).toBeGreaterThan(0);
    expect(parseFloat(match![2]!)).toBeGreaterThan(0);
  });
});

describe('spray chart — snapshot + structural', () => {
  const rows = { 'hitter-raw-bip': loadFixture('raw-bip.sample.json') };
  const options = opts({
    type: 'spray',
    title: 'Demo Hitter — Spray Chart (2025)',
  });

  it('matches normalized SVG snapshot', async () => {
    const spec = sprayBuilder.buildSpec(rows, options);
    const svg = await specToSvg(spec);
    expect(normalizeSvg(svg)).toMatchSnapshot();
  });

  it('contains the chart title and the Result legend', async () => {
    const spec = sprayBuilder.buildSpec(rows, options);
    const svg = await specToSvg(spec);
    expect(svg).toContain('Demo Hitter — Spray Chart (2025)');
    expect(svg).toContain('Result');
  });
});

describe('rolling chart — snapshot + structural', () => {
  const rows = { 'trend-rolling-average': loadFixture('rolling-windows.sample.json') };
  const options = opts({
    type: 'rolling',
    title: 'Demo Hitter — Rolling Performance (2025)',
    width: 720,
    height: 360,
  });

  it('matches normalized SVG snapshot', async () => {
    const spec = rollingBuilder.buildSpec(rows, options);
    const svg = await specToSvg(spec);
    expect(normalizeSvg(svg)).toMatchSnapshot();
  });

  it('uses faceted small multiples with independent y-scale', () => {
    const spec = rollingBuilder.buildSpec(rows, options) as {
      facet?: unknown;
      resolve?: { scale?: { y?: string } };
    };
    // This is the "no shared-axis squashing" rule from the feedback memory —
    // if anyone reverts it to a single-layer color-by-metric chart, this
    // assertion explodes loudly.
    expect(spec.facet).toBeDefined();
    expect(spec.resolve?.scale?.y).toBe('independent');
  });

  it('contains the chart title and Window End axis label', async () => {
    const spec = rollingBuilder.buildSpec(rows, options);
    const svg = await specToSvg(spec);
    expect(svg).toContain('Demo Hitter — Rolling Performance (2025)');
    expect(svg).toContain('Window End');
  });
});
