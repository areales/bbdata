import { describe, it, expect } from 'vitest';

import { formatReportTemplateList } from '../../src/commands/report.js';
import { getAllReportTemplates } from '../../src/templates/reports/registry.js';

/**
 * Regression guard for P4.13 — the "Available templates" section of
 * `bbdata report --help` was hand-written and is the same drift class
 * that left `query --help` showing 12 of 21 templates (G.1) and hid
 * `pitcher-rolling` from `viz --help` in v0.10.0.
 * `formatReportTemplateList()` now generates the block from the live
 * report-template registry, so a template registered in
 * `src/templates/reports/registry.ts` surfaces in `--help` automatically.
 */
describe('formatReportTemplateList (P4.13)', () => {
  const helpBlock = formatReportTemplateList();

  it('lists every registered report template', () => {
    const registered = getAllReportTemplates().map((t) => t.id);
    expect(registered.length).toBeGreaterThanOrEqual(13);
    for (const id of registered) {
      expect(helpBlock, `block should mention "${id}"`).toContain(id);
    }
  });

  it('groups templates under category labels in a stable order', () => {
    const proIdx = helpBlock.indexOf('Pro Scouting:');
    const amateurIdx = helpBlock.indexOf('Amateur:');
    const advanceIdx = helpBlock.indexOf('Advance:');
    const devIdx = helpBlock.indexOf('Player Dev:');
    const execIdx = helpBlock.indexOf('Executive:');

    expect(proIdx).toBeGreaterThanOrEqual(0);
    expect(amateurIdx).toBeGreaterThan(proIdx);
    expect(advanceIdx).toBeGreaterThan(amateurIdx);
    expect(devIdx).toBeGreaterThan(advanceIdx);
    expect(execIdx).toBeGreaterThan(devIdx);
  });
});
