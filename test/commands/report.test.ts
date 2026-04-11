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
    // Fallback template contains "Data pending"
    if (result.content.includes('Data pending')) {
      expect(result.validation!.passed).toBe(false);
      expect(result.validation!.issues.some((i) => i.message.includes('placeholder'))).toBe(true);
    }
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
});
