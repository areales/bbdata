import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';

// Import templates to register them before mocking adapters
import '../../src/templates/queries/index.js';

vi.mock('../../src/adapters/index.js', () => ({
  resolveAdapters: vi.fn(),
  getAdapter: vi.fn(),
  getAllAdapters: vi.fn(),
}));

vi.mock('../../src/cache/store.js', () => ({
  getCached: vi.fn(),
  setCache: vi.fn(),
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
  isSourceEnabled: vi.fn(() => true),
  sourceConfigKey: vi.fn((src: string) => src),
}));

import { query, registerQueryCommand } from '../../src/commands/query.js';
import { resolveAdapters } from '../../src/adapters/index.js';
import { log } from '../../src/utils/logger.js';

const MOCK_PITCH: Record<string, unknown> = {
  pitch_type: 'FF',
  release_speed: 95.2,
  release_spin_rate: 2400,
  pfx_x: -1.2,
  pfx_z: 1.8,
  plate_x: 0.3,
  plate_z: 2.5,
  description: 'swinging_strike',
  events: null,
  bb_type: null,
  stand: 'R',
  p_throws: 'R',
  pitcher: '123456',
  player_name: 'Test Player',
  batter: '654321',
  batter_name: 'Test Batter',
  game_date: '2026-06-01',
};

function makeMockAdapter() {
  return {
    source: 'savant' as const,
    description: 'Mock',
    supports: () => true,
    resolvePlayer: vi.fn(),
    fetch: vi.fn().mockResolvedValue({
      data: [MOCK_PITCH],
      source: 'savant',
      cached: false,
      fetchedAt: '2027-01-15T00:00:00.000Z',
      meta: { rowCount: 1, season: 2026, query: {} },
    }),
  };
}

const seasonNotices = () =>
  vi.mocked(log.warn).mock.calls.filter(([msg]) => msg.includes('No --season given'));

/** Run `bbdata query …` through real Commander parsing. */
async function runCli(...args: string[]) {
  const program = new Command();
  program.exitOverride();
  registerQueryCommand(program);
  await program.parseAsync(['node', 'bbdata', 'query', ...args]);
}

/**
 * From January 1 until Opening Day the calendar year has no games, so a
 * command with no --season used to request an empty season and return 0 rows.
 */
describe('query default season', () => {
  let adapter: ReturnType<typeof makeMockAdapter>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    adapter = makeMockAdapter();
    vi.mocked(resolveAdapters).mockReturnValue([adapter]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const fetchedSeason = () => adapter.fetch.mock.calls[0]![0].season;

  describe('in January', () => {
    beforeEach(() => {
      vi.setSystemTime(new Date(2027, 0, 15, 12));
    });

    it('fetches the previous season when --season is omitted on the command line', async () => {
      await runCli('pitcher-arsenal', '--player', 'Test Player');

      expect(log.error).not.toHaveBeenCalled();
      expect(fetchedSeason()).toBe(2026);
      expect(seasonNotices()).toHaveLength(1);
      expect(seasonNotices()[0]![0]).toContain('using 2026');

      // stdout carries only the result, and its envelope names the season used.
      expect(log.data).toHaveBeenCalledTimes(1);
      const envelope = JSON.parse(vi.mocked(log.data).mock.calls[0]![0]);
      expect(envelope.meta.season).toBe(2026);
    });

    it('leaves an explicit --season alone, even one with no games yet', async () => {
      await runCli('pitcher-arsenal', '--player', 'Test Player', '--season', '2027');

      expect(fetchedSeason()).toBe(2027);
      expect(seasonNotices()).toHaveLength(0);
    });

    it('accepts the -s short flag the same way', async () => {
      await runCli('pitcher-arsenal', '--player', 'Test Player', '-s', '2024');

      expect(fetchedSeason()).toBe(2024);
      expect(seasonNotices()).toHaveLength(0);
    });

    it('applies the same default to the programmatic API', async () => {
      const result = await query({ template: 'pitcher-arsenal', player: 'Test Player' });

      expect(fetchedSeason()).toBe(2026);
      expect(result.meta.season).toBe(2026);
      expect(seasonNotices()).toHaveLength(1);
    });

    it('prints no notice when --seasons names the range', async () => {
      // trend-year-over-year fetches the --seasons range, so a notice naming
      // the default year would describe a season the command never requests.
      await query({
        template: 'trend-year-over-year',
        player: 'Test Player',
        seasons: '2023-2025',
      }).catch(() => undefined);

      expect(adapter.fetch.mock.calls[0]![0].season).toBe(2025);
      expect(adapter.fetch.mock.calls[0]![0].start_season).toBe(2023);
      expect(seasonNotices()).toHaveLength(0);
    });
  });

  it('fetches the current year once the cutover has passed, with no notice', async () => {
    vi.setSystemTime(new Date(2027, 3, 2, 12));
    await runCli('pitcher-arsenal', '--player', 'Test Player');

    expect(fetchedSeason()).toBe(2027);
    expect(seasonNotices()).toHaveLength(0);
  });

  it('describes the default in --help instead of baking the calendar year in', () => {
    vi.setSystemTime(new Date(2027, 0, 15, 12));
    const program = new Command();
    registerQueryCommand(program);
    const help = program.commands.find((c) => c.name() === 'query')!.helpInformation();

    // Commander wraps long descriptions, so compare with whitespace collapsed.
    expect(help.replace(/\s+/g, ' ')).toContain(
      'Season year (default: 2026; the current year from April 1, the previous year before that)',
    );
    expect(help).not.toContain('(default: "2027")');
  });
});
