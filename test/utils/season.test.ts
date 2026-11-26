import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../src/utils/logger.js', () => ({
  log: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), success: vi.fn(), error: vi.fn(), data: vi.fn() },
}));

import {
  SEASON_CUTOVER,
  defaultSeason,
  resolveSeason,
  seasonOptionDescription,
} from '../../src/utils/season.js';
import { log } from '../../src/utils/logger.js';

/** Local-time date. Months are 1-based here, unlike the Date constructor. */
const on = (year: number, month: number, day: number, hour = 12) =>
  new Date(year, month - 1, day, hour);

describe('defaultSeason', () => {
  it('cuts over on April 1', () => {
    expect(SEASON_CUTOVER).toEqual({ month: 4, day: 1 });
  });

  it.each([
    ['January', on(2027, 1, 15), 2026],
    ['January 1', on(2027, 1, 1, 0), 2026],
    ['mid-March', on(2027, 3, 15), 2026],
    ['the day before the cutover', on(2027, 3, 31, 23), 2026],
    ['the cutover day', on(2027, 4, 1, 0), 2027],
    ['the day after the cutover', on(2027, 4, 2), 2027],
    ['July', on(2027, 7, 4), 2027],
    ['November', on(2026, 11, 26), 2026],
    ['December 31', on(2026, 12, 31, 23), 2026],
  ])('in %s returns the right season', (_label, now, expected) => {
    expect(defaultSeason(now)).toBe(expected);
  });

  describe('outside UTC', () => {
    const originalTz = process.env.TZ;
    afterEach(() => {
      process.env.TZ = originalTz;
    });

    it('reads the local date, not the UTC one', () => {
      // 03:00 UTC on April 1 is still 8 PM on March 31 in Los Angeles. The
      // suite pins TZ=UTC, where local and UTC getters agree, so only a
      // non-UTC zone can tell them apart.
      process.env.TZ = 'America/Los_Angeles';
      const instant = new Date('2027-04-01T03:00:00Z');
      expect(instant.getDate()).toBe(31); // guard: the zone change took effect
      expect(defaultSeason(instant)).toBe(2026);
      expect(defaultSeason(new Date('2027-04-01T07:00:00Z'))).toBe(2027);
    });
  });
});

describe('resolveSeason', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const seasonNotices = () =>
    vi.mocked(log.warn).mock.calls.filter(([msg]) => msg.includes('No --season given'));

  it('returns an explicit season untouched and prints nothing', () => {
    expect(resolveSeason(2027, { now: on(2027, 1, 15) })).toBe(2027);
    expect(resolveSeason(2019, { now: on(2027, 7, 4) })).toBe(2019);
    expect(log.warn).not.toHaveBeenCalled();
    expect(log.data).not.toHaveBeenCalled();
  });

  it('falls back to the previous season before the cutover, with one stderr notice', () => {
    expect(resolveSeason(undefined, { now: on(2027, 1, 15) })).toBe(2026);

    const notices = seasonNotices();
    expect(notices).toHaveLength(1);
    const message = notices[0]![0];
    expect(message).toContain('using 2026');
    expect(message).toContain('April 1');
    expect(message).toContain('--season 2027');
    expect(message).not.toContain('\n');
    // The notice goes through log.warn (stderr), never stdout.
    expect(log.data).not.toHaveBeenCalled();
  });

  it('uses the calendar year from the cutover on, with no notice', () => {
    expect(resolveSeason(undefined, { now: on(2027, 4, 2) })).toBe(2027);
    expect(resolveSeason(undefined, { now: on(2027, 7, 4) })).toBe(2027);
    expect(resolveSeason(undefined, { now: on(2026, 11, 26) })).toBe(2026);
    expect(log.warn).not.toHaveBeenCalled();
  });

  it('stays quiet when asked, and still falls back', () => {
    expect(resolveSeason(undefined, { now: on(2027, 3, 15), quiet: true })).toBe(2026);
    expect(log.warn).not.toHaveBeenCalled();
  });
});

describe('seasonOptionDescription', () => {
  it('names the season the default resolves to and the rule', () => {
    expect(seasonOptionDescription(on(2027, 1, 15))).toBe(
      'Season year (default: 2026; the current year from April 1, the previous year before that)',
    );
    expect(seasonOptionDescription(on(2027, 7, 4))).toContain('default: 2027;');
  });
});
