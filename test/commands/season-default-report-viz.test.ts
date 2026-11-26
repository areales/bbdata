import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';

// Register query and report templates before anything is mocked
import '../../src/templates/queries/index.js';
import '../../src/templates/reports/registry.js';

vi.mock('../../src/commands/query.js', () => ({
  query: vi.fn(),
}));

vi.mock('../../src/viz/embed.js', () => ({
  generateReportGraphs: vi.fn(async () => ({})),
}));

vi.mock('../../src/viz/render.js', () => ({
  specToSvg: vi.fn(async () => '<svg data-test="stub"/>'),
  specToHtml: vi.fn((svg: string) => `<!doctype html><html>${svg}</html>`),
  specToPdf: vi.fn(async () => Buffer.from('%PDF-1.7\n%%EOF\n')),
  normalizeSvg: vi.fn((s: string) => s),
}));

vi.mock('../../src/viz/rasterize.js', () => ({
  rasterizeSvg: vi.fn(() => Buffer.from([0x89, 0x50, 0x4e, 0x47])),
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

import { registerReportCommand } from '../../src/commands/report.js';
import { registerVizCommand } from '../../src/commands/viz.js';
import { query as runQuery } from '../../src/commands/query.js';
import { log } from '../../src/utils/logger.js';

const seasonNotices = () =>
  vi.mocked(log.warn).mock.calls.filter(([msg]) => msg.includes('No --season given'));

const requestedSeasons = () =>
  vi.mocked(runQuery).mock.calls.map(([opts]) => opts.season);

function makeProgram() {
  const program = new Command();
  program.exitOverride();
  registerReportCommand(program);
  registerVizCommand(program);
  return program;
}

/** Run `bbdata <command> …` through real Commander parsing. */
async function runCli(...args: string[]) {
  await makeProgram().parseAsync(['node', 'bbdata', ...args]);
}

/**
 * `report` and `viz` resolve the season once and pass it to every sub-query,
 * so the offseason fallback applies to all of them and is announced once.
 */
describe('report and viz default season', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.mocked(runQuery).mockResolvedValue({
      data: [
        { pitch_type: 'FF', pfx_x: 0.8, pfx_z: 1.2, release_speed: 95, 'Pitch Type': 'FF', 'Usage %': '50%' },
        { pitch_type: 'SL', pfx_x: -0.5, pfx_z: 0.4, release_speed: 87, 'Pitch Type': 'SL', 'Usage %': '50%' },
      ],
      formatted: '{}',
      meta: { template: 'pitcher-arsenal', source: 'savant', cached: false, sampleSize: 2, season: 2026, queryTimeMs: 0, cliVersion: '0.0.0-test' },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('in January', () => {
    beforeEach(() => {
      vi.setSystemTime(new Date(2027, 0, 15, 12));
    });

    it('report sends the previous season to every sub-query and says so once', async () => {
      await runCli('report', 'pro-pitcher-eval', '--player', 'Corbin Burnes');

      expect(log.error).not.toHaveBeenCalled();
      const seasons = requestedSeasons();
      expect(seasons.length).toBeGreaterThan(1);
      expect(new Set(seasons)).toEqual(new Set([2026]));
      expect(seasonNotices()).toHaveLength(1);

      const markdown = vi.mocked(log.data).mock.calls[0]![0];
      expect(markdown).toContain('**Season:** 2026');
    });

    it('report leaves an explicit --season alone', async () => {
      await runCli('report', 'pro-pitcher-eval', '--player', 'Corbin Burnes', '--season', '2027');

      expect(new Set(requestedSeasons())).toEqual(new Set([2027]));
      expect(seasonNotices()).toHaveLength(0);
    });

    it('viz sends the previous season to its query and says so once', async () => {
      await runCli('viz', 'movement', '--player', 'Corbin Burnes');

      expect(log.error).not.toHaveBeenCalled();
      expect(requestedSeasons()).toEqual([2026]);
      expect(seasonNotices()).toHaveLength(1);
    });

    it('viz leaves an explicit --season alone', async () => {
      await runCli('viz', 'movement', '--player', 'Corbin Burnes', '--season', '2027');

      expect(requestedSeasons()).toEqual([2027]);
      expect(seasonNotices()).toHaveLength(0);
    });
  });

  describe('in July', () => {
    beforeEach(() => {
      vi.setSystemTime(new Date(2027, 6, 4, 12));
    });

    it('report and viz use the current year with no notice', async () => {
      await runCli('report', 'pro-pitcher-eval', '--player', 'Corbin Burnes');
      await runCli('viz', 'movement', '--player', 'Corbin Burnes');

      expect(new Set(requestedSeasons())).toEqual(new Set([2027]));
      expect(seasonNotices()).toHaveLength(0);
    });
  });

  it.each(['report', 'viz'])('%s --help describes the default season', (name) => {
    vi.setSystemTime(new Date(2027, 0, 15, 12));
    const help = makeProgram().commands.find((c) => c.name() === name)!.helpInformation();

    expect(help.replace(/\s+/g, ' ')).toContain(
      'Season year (default: 2026; the current year from April 1, the previous year before that)',
    );
    expect(help).not.toContain('(default: "2027")');
  });
});
