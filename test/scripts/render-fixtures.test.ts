import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));

import { FIXTURES } from '../../scripts/render-fixtures.js';
import { listChartTypes } from '../../src/viz/charts/index.js';

/**
 * Regression guard for P4.12 — the fixture gallery covered 4 of the 6
 * registered chart types for four months, and the registry-completeness
 * reviewer flagged the gap on three separate audits. Every chart type
 * registered in `src/viz/charts/index.ts` must have a gallery entry in
 * `scripts/render-fixtures.ts`, and every entry's fixture file must exist.
 *
 * The 30s timeout follows the repo convention for suites that import
 * @resvg/resvg-js (render-fixtures.ts pulls in rasterize.js).
 */
describe('render-fixtures gallery coverage (P4.12)', { timeout: 30_000 }, () => {
  it('has a gallery entry for every registered chart type', () => {
    const covered = new Set(FIXTURES.map((f) => f.type));
    for (const type of listChartTypes()) {
      expect(covered.has(type), `chart type "${type}" is missing from FIXTURES`).toBe(true);
    }
  });

  it('references only fixture files that exist', () => {
    const fixturesDir = resolve(__dirname, '../fixtures/viz');
    for (const f of FIXTURES) {
      const full = resolve(fixturesDir, f.fixture);
      expect(existsSync(full), `fixture file "${f.fixture}" for "${f.type}" not found`).toBe(true);
    }
  });
});
