import { describe, it, expect } from 'vitest';

import '../../src/templates/queries/index.js';
import { formatTemplateList } from '../../src/commands/query.js';
import { getAllTemplates } from '../../src/templates/queries/registry.js';

/**
 * Regression guard for gap G.1 in COURSE_TEST_PLAN.md — the "Available
 * templates" section of `bbdata query --help` was hand-written and drifted
 * to 12 of 21 templates. `formatTemplateList()` now generates the block
 * from the live template registry, so a new template registered in
 * `src/templates/queries/index.ts` surfaces in `--help` automatically.
 */
describe('formatTemplateList (G.1)', () => {
  const helpBlock = formatTemplateList();

  it('lists every registered query template', () => {
    const registered = getAllTemplates().map((t) => t.id);
    expect(registered.length).toBeGreaterThanOrEqual(21);
    for (const id of registered) {
      expect(helpBlock, `block should mention "${id}"`).toContain(id);
    }
  });

  it('groups templates under category labels in a stable order', () => {
    const pitcherIdx = helpBlock.indexOf('Pitcher:');
    const hitterIdx = helpBlock.indexOf('Hitter:');
    const matchupIdx = helpBlock.indexOf('Matchup:');
    const leaderboardIdx = helpBlock.indexOf('Leaderboard:');
    const trendIdx = helpBlock.indexOf('Trend:');

    expect(pitcherIdx).toBeGreaterThanOrEqual(0);
    expect(hitterIdx).toBeGreaterThan(pitcherIdx);
    expect(matchupIdx).toBeGreaterThan(hitterIdx);
    expect(leaderboardIdx).toBeGreaterThan(matchupIdx);
    expect(trendIdx).toBeGreaterThan(leaderboardIdx);
  });
});
