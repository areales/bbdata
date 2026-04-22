import { registerTemplate, type QueryTemplate } from './registry.js';
import { assertFields } from '../../utils/validate-records.js';
import type { PitchData } from '../../adapters/types.js';

const REQUIRED_FIELDS = ['pitch_type', 'release_speed', 'game_date', 'description'];

const FASTBALL_FAMILY = new Set(['FF', 'SI', 'FC']);

const SWING_DESCRIPTIONS = new Set([
  'swinging_strike',
  'swinging_strike_blocked',
  'foul',
  'foul_tip',
  'hit_into_play',
  'hit_into_play_no_out',
  'hit_into_play_score',
]);
const WHIFF_DESCRIPTIONS = new Set(['swinging_strike', 'swinging_strike_blocked']);
const CSW_DESCRIPTIONS = new Set([
  'called_strike',
  'swinging_strike',
  'swinging_strike_blocked',
]);

// Outings with fewer than this many tracked pitches are excluded from
// rolling windows. Filters out position-player innings and one-batter relief
// appearances that would be pure noise in a per-start trend.
const MIN_PITCHES_PER_OUTING = 10;

const template: QueryTemplate = {
  id: 'pitcher-rolling-trend',
  name: 'Pitcher Rolling Trend',
  category: 'trend',
  description: '5-start rolling averages for pitchers — velocity (FB), Whiff %, K %, CSW %',
  preferredSources: ['savant'],
  requiredParams: ['player'],
  optionalParams: ['season', 'window'],
  examples: [
    'bbdata query pitcher-rolling-trend --player "Gerrit Cole" --season 2025',
  ],

  buildQuery(params) {
    return {
      player_name: params.player,
      season: params.season ?? new Date().getFullYear(),
      stat_type: 'pitching',
    };
  },

  columns() {
    return ['Window', 'Window End', 'Starts', 'Avg Velo', 'Whiff %', 'K %', 'CSW %'];
  },

  transform(data, params) {
    const pitches = data as PitchData[];
    if (pitches.length === 0) return [];
    assertFields(pitches, REQUIRED_FIELDS, 'pitcher-rolling-trend');

    const byDate = new Map<string, PitchData[]>();
    for (const p of pitches) {
      const group = byDate.get(p.game_date) ?? [];
      group.push(p);
      byDate.set(p.game_date, group);
    }

    const dates = Array.from(byDate.entries())
      .filter(([, group]) => group.length >= MIN_PITCHES_PER_OUTING)
      .map(([d]) => d)
      .sort();

    const windowSize = params?.window && params.window > 0 ? params.window : 5;

    if (dates.length < windowSize) {
      return [{
        Window: 'Insufficient data',
        'Window End': '',
        Starts: dates.length,
        'Avg Velo': '—',
        'Whiff %': '—',
        'K %': '—',
        'CSW %': '—',
      }];
    }

    const results: Record<string, unknown>[] = [];
    const step = Math.max(1, Math.floor(windowSize / 3));

    for (let i = 0; i <= dates.length - windowSize; i += step) {
      const windowDates = dates.slice(i, i + windowSize);
      const windowPitches = windowDates.flatMap((d) => byDate.get(d) ?? []);

      const fbPitches = windowPitches.filter(
        (p) => FASTBALL_FAMILY.has(p.pitch_type) && p.release_speed > 0,
      );
      const avgVelo = fbPitches.length > 0
        ? fbPitches.reduce((s, p) => s + p.release_speed, 0) / fbPitches.length
        : null;

      const swings = windowPitches.filter((p) => SWING_DESCRIPTIONS.has(p.description));
      const whiffs = windowPitches.filter((p) => WHIFF_DESCRIPTIONS.has(p.description));
      const csw = windowPitches.filter((p) => CSW_DESCRIPTIONS.has(p.description));

      const pas = windowPitches.filter((p) => p.events !== null);
      const ks = pas.filter((p) => p.events === 'strikeout');

      const windowEnd = windowDates[windowDates.length - 1]!;

      results.push({
        Window: `${windowDates[0]} → ${windowEnd}`,
        'Window End': windowEnd,
        Starts: windowDates.length,
        'Avg Velo': avgVelo !== null ? avgVelo.toFixed(1) + ' mph' : '—',
        'Whiff %': swings.length > 0
          ? ((whiffs.length / swings.length) * 100).toFixed(1) + '%'
          : '—',
        'K %': pas.length > 0
          ? ((ks.length / pas.length) * 100).toFixed(1) + '%'
          : '—',
        'CSW %': windowPitches.length > 0
          ? ((csw.length / windowPitches.length) * 100).toFixed(1) + '%'
          : '—',
      });
    }

    return results;
  },
};

registerTemplate(template);
