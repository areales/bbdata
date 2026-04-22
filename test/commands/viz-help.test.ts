import { describe, it, expect } from 'vitest';

import { formatChartTypeList } from '../../src/commands/viz.js';
import { listChartTypes, listChartAliases } from '../../src/viz/charts/index.js';

/**
 * Regression guard for the viz counterpart of gap G.1 — F1.1 shipped
 * `pitcher-rolling` in the chart-builder registry but the hand-written
 * `bbdata viz --help` block was never updated, so the new type rendered
 * but was undiscoverable. `formatChartTypeList()` now generates the block
 * from the live registry + a `Record<ChartType, string>` description map,
 * so adding a new chart type to `src/viz/types.ts` forces the compiler
 * to demand a description, and new types surface in `--help` automatically.
 */
describe('formatChartTypeList (viz G.1)', () => {
  const helpBlock = formatChartTypeList();

  it('lists every registered canonical chart type', () => {
    const registered = listChartTypes();
    expect(registered.length).toBeGreaterThanOrEqual(6);
    for (const id of registered) {
      expect(helpBlock, `block should mention canonical "${id}"`).toContain(id);
    }
  });

  it('lists every registered alias mapped to its canonical', () => {
    const aliases = listChartAliases();
    for (const [alias, canonical] of Object.entries(aliases)) {
      expect(helpBlock).toContain(alias);
      const aliasIdx = helpBlock.indexOf(alias);
      const arrowIdx = helpBlock.indexOf('→', aliasIdx);
      expect(arrowIdx).toBeGreaterThan(aliasIdx);
      expect(helpBlock.slice(arrowIdx, arrowIdx + 40)).toContain(canonical);
    }
  });

  it('renders canonical types before the aliases section', () => {
    const canonicalIdx = helpBlock.indexOf('Chart types (canonical):');
    const aliasesIdx = helpBlock.indexOf('Aliases:');
    expect(canonicalIdx).toBeGreaterThanOrEqual(0);
    expect(aliasesIdx).toBeGreaterThan(canonicalIdx);
  });
});
