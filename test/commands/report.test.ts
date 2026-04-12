import { describe, it, expect, vi, beforeEach } from 'vitest';

// Must import report templates to register them
import '../../src/templates/reports/registry.js';

vi.mock('../../src/commands/query.js', () => ({
  query: vi.fn(),
}));

// Avoid cascading into the real vega pipeline during report tests.
vi.mock('../../src/viz/embed.js', () => ({
  generateReportGraphs: vi.fn(async () => ({})),
}));

vi.mock('../../src/utils/logger.js', () => ({
  log: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), success: vi.fn(), error: vi.fn(), data: vi.fn() },
}));

vi.mock('../../src/config/config.js', () => ({
  getConfig: vi.fn(() => ({
    defaultFormat: 'json',
    defaultAudience: 'analyst',
    cache: { enabled: true, maxAgeDays: 30, directory: '' },
    templates: { directory: '' },
    sources: {},
  })),
  getConfigDir: vi.fn(() => '/tmp/bbdata'),
  getCacheDir: vi.fn(() => '/tmp/bbdata/cache'),
  getTemplatesDir: vi.fn(() => '/tmp/bbdata/templates'),
  setConfig: vi.fn(),
}));

import { report } from '../../src/commands/report.js';
import { query as runQuery } from '../../src/commands/query.js';

describe('report command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock query to return minimal data for all data requirements
    vi.mocked(runQuery).mockResolvedValue({
      data: [{ 'Pitch Type': 'FF', 'Usage %': '50%' }],
      formatted: '{}',
      meta: { template: 'pitcher-arsenal', source: 'savant', cached: false, rowCount: 1, season: 2025 },
    });
  });

  it('throws for unknown template', async () => {
    await expect(
      report({ template: 'nonexistent-report' }),
    ).rejects.toThrow('Unknown report template');
  });

  it('returns report content for a valid template', async () => {
    const result = await report({
      template: 'pro-pitcher-eval',
      player: 'Corbin Burnes',
      season: 2025,
      audience: 'scout',
    });

    expect(result).toHaveProperty('content');
    expect(result).toHaveProperty('formatted');
    expect(result).toHaveProperty('meta');
    expect(result.meta.template).toBe('pro-pitcher-eval');
    expect(result.meta.player).toBe('Corbin Burnes');
    expect(result.meta.audience).toBe('scout');
  });

  it('fetches data for each data requirement', async () => {
    await report({
      template: 'pro-pitcher-eval',
      player: 'Corbin Burnes',
      season: 2025,
    });

    // pro-pitcher-eval has 3 data requirements
    expect(runQuery).toHaveBeenCalledTimes(3);
  });

  it('fetches data for each pro-hitter-eval data requirement', async () => {
    await report({
      template: 'pro-hitter-eval',
      player: 'Aaron Judge',
      season: 2025,
    });

    // pro-hitter-eval has 5 data requirements:
    // hitter-batted-ball, hitter-vs-pitch-type, hitter-hot-cold-zones,
    // hitter-handedness-splits, trend-rolling-average
    expect(runQuery).toHaveBeenCalledTimes(5);
  });

  it('validation detects placeholder text', async () => {
    // Mock query to return null data (triggers fallback template with "Data pending")
    vi.mocked(runQuery).mockResolvedValue({
      data: [],
      formatted: '{}',
      meta: { template: 'pitcher-arsenal', source: 'savant', cached: false, rowCount: 0, season: 2025 },
    });

    const result = await report({
      template: 'pro-pitcher-eval',
      player: 'Test Player',
      season: 2025,
      validate: true,
    });

    expect(result.validation).toBeDefined();
    // BBDATA-008 part A: checks array is always populated when validation runs,
    // even when issues are present.
    expect(result.validation!.checks).toContain('section-present');
    expect(result.validation!.checks.length).toBeGreaterThan(0);
    // Fallback template contains "Data pending"
    if (result.content.includes('Data pending')) {
      expect(result.validation!.passed).toBe(false);
      expect(result.validation!.issues.some((i) => i.message.includes('placeholder'))).toBe(true);
    }
  });

  it('validation emits positive signal on clean runs (BBDATA-008 part A)', async () => {
    // Ensure query returns healthy data (default beforeEach mock is good)
    const result = await report({
      template: 'relief-pitcher-quick',
      player: 'Edwin Diaz',
      season: 2025,
      validate: true,
    });

    // Structured validation is always populated when --validate is passed.
    expect(result.validation).toBeDefined();
    expect(result.validation!.checks).toEqual(
      expect.arrayContaining(['section-present', 'placeholder-free', 'generic-phrases', 'length']),
    );
    // Markdown content begins with an HTML-comment banner naming the checks
    // that ran — visible in raw text, invisible when rendered.
    expect(result.content.startsWith('<!-- bbdata validation:')).toBe(true);
    expect(result.content).toContain('section-present');
  });

  it('markdown has no validation banner when --validate is not passed', async () => {
    const result = await report({
      template: 'relief-pitcher-quick',
      player: 'Edwin Diaz',
      season: 2025,
    });

    expect(result.validation).toBeUndefined();
    expect(result.content.startsWith('<!-- bbdata validation:')).toBe(false);
  });

  it('returns JSON format when requested', async () => {
    const result = await report({
      template: 'relief-pitcher-quick',
      player: 'Edwin Diaz',
      season: 2025,
      format: 'json',
    });

    const parsed = JSON.parse(result.formatted);
    expect(parsed).toHaveProperty('content');
    expect(parsed).toHaveProperty('meta');
  });

  it('propagates --team into the advance-lineup render context (BBDATA-012)', async () => {
    const result = await report({
      template: 'advance-lineup',
      team: 'LAD',
      season: 2025,
      audience: 'coach',
    });

    // H1 title should read "# Advance Report: LAD Lineup" — no double space.
    expect(result.content).toContain('# Advance Report: LAD Lineup');
    expect(result.content).not.toContain('Advance Report:  Lineup');
    // Opponent row in the header table should be populated.
    expect(result.content).toMatch(/\|\s*Opponent\s*\|\s*LAD\s*\|/);
  });

  it('advance-lineup without --team still renders without crashing', async () => {
    const result = await report({
      template: 'advance-lineup',
      season: 2025,
      audience: 'coach',
    });

    // Missing team renders as empty (same permissive behavior as missing --player).
    expect(result.content).toContain('Advance Report:');
    expect(result).toHaveProperty('meta');
  });

  it('strict mode (default) throws when a required data query fails (BBDATA-001)', async () => {
    vi.mocked(runQuery).mockRejectedValue(new Error('Adapter "savant" returned 0 rows'));

    await expect(
      report({
        template: 'pro-pitcher-eval',
        player: 'Corbin Burnes',
        season: 2026,
        audience: 'scout',
      }),
    ).rejects.toThrow(/required data query\(s\) failed/);
  });

  it('strict mode error message names the failed queries and suggests --no-strict', async () => {
    vi.mocked(runQuery).mockRejectedValue(new Error('Adapter "savant" returned 0 rows for "pitcher-arsenal"'));

    try {
      await report({
        template: 'pro-pitcher-eval',
        player: 'Corbin Burnes',
        season: 2026,
      });
      expect.fail('expected report() to throw');
    } catch (err) {
      const msg = (err as Error).message;
      expect(msg).toContain('pitcher-arsenal');
      expect(msg).toContain('--no-strict');
    }
  });

  it('strict=false preserves the legacy lenient behavior (BBDATA-001 opt-out)', async () => {
    vi.mocked(runQuery).mockRejectedValue(new Error('Adapter "savant" returned 0 rows'));

    const result = await report({
      template: 'pro-pitcher-eval',
      player: 'Corbin Burnes',
      season: 2026,
      strict: false,
    });

    // Should return a stub-shell result, not throw.
    expect(result).toHaveProperty('content');
    expect(result.meta.template).toBe('pro-pitcher-eval');
  });

  it('draft-board-card-pitcher renders with pitcher tool grades (BBDATA-013)', async () => {
    const result = await report({
      template: 'draft-board-card-pitcher',
      player: 'Seth Hernandez',
      audience: 'gm',
    });

    // Pitcher tool grid should have Fastball/Breaking/Changeup/Command
    expect(result.content).toContain('Fastball');
    expect(result.content).toContain('Breaking Ball');
    expect(result.content).toContain('Changeup');
    expect(result.content).toContain('Command');
    // Hitter-specific columns should NOT appear in this variant
    expect(result.content).not.toMatch(/\|\s*Hit\s*\|\s*Power\s*\|\s*Speed\s*\|/);
    expect(result.meta.template).toBe('draft-board-card-pitcher');
  });

  it('draft-board-card (hitter) remains unchanged with hitter tool grades', async () => {
    const result = await report({
      template: 'draft-board-card',
      player: 'Ethan Holliday',
      audience: 'gm',
    });

    // Original hitter tool grid is preserved — back-compat check
    expect(result.content).toMatch(/\|\s*Hit\s*\|\s*Power\s*\|\s*Speed\s*\|\s*Field\s*\|\s*Arm\s*\|/);
    expect(result.content).not.toContain('Fastball');
  });

  it('JSON output exposes structured sections keyed by queryTemplate id (BBDATA-014)', async () => {
    vi.mocked(runQuery).mockImplementation(async (opts: { template: string }) => ({
      data: [{ marker: opts.template }],
      formatted: '{}',
      meta: { template: opts.template, source: 'savant', cached: false, rowCount: 1, season: 2025 },
    }));

    const result = await report({
      template: 'pro-pitcher-eval',
      player: 'Corbin Burnes',
      season: 2025,
      audience: 'scout',
      format: 'json',
    });

    const parsed = JSON.parse(result.formatted);
    expect(parsed).toHaveProperty('sections');
    // pro-pitcher-eval has 3 data requirements; sections should hold one entry per id.
    const sectionKeys = Object.keys(parsed.sections);
    expect(sectionKeys.length).toBe(3);
    // Each section's value should be the raw query data, not a markdown string.
    for (const key of sectionKeys) {
      expect(Array.isArray(parsed.sections[key])).toBe(true);
      expect(parsed.sections[key][0]).toEqual({ marker: key });
    }
    // The markdown `content` field is preserved for back-compat.
    expect(typeof parsed.content).toBe('string');
    expect(parsed.content.length).toBeGreaterThan(0);
  });
});
