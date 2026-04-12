import { registerTemplate, type QueryTemplate } from './registry.js';
import type { PitchData } from '../../adapters/types.js';

/**
 * Pitcher — Times Through the Order (TTO)
 *
 * Assigns every PA a TTO index based on how many times that batter has
 * already faced the pitcher in the same game. Buckets into 1st / 2nd /
 * 3rd+ passes and returns per-bucket PA counts, K%, BB%, xwOBA, and
 * average fastball velocity. Used by the advance-sp report's "Times
 * Through the Order" section to highlight velocity decay and plate-
 * discipline shifts across a pitcher's times-through.
 *
 * Requires `at_bat_number` and `batter_id` to be present on pitch rows
 * (part of the BBDATA-011 PitchData extension). PAs without
 * `at_bat_number` are skipped — there's no reliable way to reconstruct
 * PA sequencing from pitch-level data alone.
 *
 * TTO assignment is per-`game_date`, so doubleheaders naturally reset
 * the counter (the same batter facing the pitcher in game 1 and again
 * in game 2 of a doubleheader each start at TTO 1). This matches how
 * box scores track TTO.
 */

interface Bucket {
  label: string;
  paCount: number;
  strikeouts: number;
  walks: number;
  xwobaSum: number;
  xwobaN: number;
  fbVelos: number[];
}

const FB_PITCH_TYPES = new Set(['FF', 'SI', 'FC']);
const STRIKEOUT_EVENTS = new Set(['strikeout', 'strikeout_double_play', 'strikeout_triple_play']);
const WALK_EVENTS = new Set(['walk', 'hit_by_pitch']);

function newBucket(label: string): Bucket {
  return {
    label,
    paCount: 0,
    strikeouts: 0,
    walks: 0,
    xwobaSum: 0,
    xwobaN: 0,
    fbVelos: [],
  };
}

const template: QueryTemplate = {
  id: 'pitcher-tto',
  name: 'Pitcher Times Through the Order',
  category: 'pitcher',
  description: 'Per-PA K%, BB%, xwOBA, and fastball velo grouped by 1st / 2nd / 3rd+ time through the order',
  preferredSources: ['savant'],
  requiredParams: ['player'],
  optionalParams: ['season'],
  examples: [
    'bbdata query pitcher-tto --player "Gerrit Cole" --season 2024',
  ],

  buildQuery(params) {
    return {
      player_name: params.player,
      season: params.season ?? new Date().getFullYear(),
      stat_type: 'pitching',
    };
  },

  columns() {
    return ['Pass', 'PAs', 'K %', 'BB %', 'xwOBA', 'Avg FB Velo'];
  },

  transform(data) {
    const pitches = data as PitchData[];
    if (pitches.length === 0) return [];

    // Step 1: assign a TTO index to each unique (game_date, at_bat_number) PA.
    // We walk PAs in at_bat_number order within each game, tracking how many
    // times each batter has already appeared. The TTO for a PA = that batter's
    // appearance count *for this game* up to and including the PA.

    // Build a set of unique PA identifiers with their metadata.
    interface PaKey {
      game_date: string;
      at_bat_number: number;
      batter_id: string;
    }
    const seenPaIds = new Set<string>();
    const uniquePas: PaKey[] = [];
    for (const p of pitches) {
      if (p.at_bat_number == null || !p.game_date || !p.batter_id) continue;
      const id = `${p.game_date}:${p.at_bat_number}`;
      if (seenPaIds.has(id)) continue;
      seenPaIds.add(id);
      uniquePas.push({
        game_date: p.game_date,
        at_bat_number: p.at_bat_number,
        batter_id: p.batter_id,
      });
    }

    if (uniquePas.length === 0) return [];

    // Sort PAs per game by at_bat_number, then assign TTO.
    uniquePas.sort((a, b) => {
      if (a.game_date !== b.game_date) return a.game_date < b.game_date ? -1 : 1;
      return a.at_bat_number - b.at_bat_number;
    });

    const ttoByPa = new Map<string, number>();
    const batterSeenByGame = new Map<string, Map<string, number>>();
    for (const pa of uniquePas) {
      let gameMap = batterSeenByGame.get(pa.game_date);
      if (!gameMap) {
        gameMap = new Map<string, number>();
        batterSeenByGame.set(pa.game_date, gameMap);
      }
      const prior = gameMap.get(pa.batter_id) ?? 0;
      const tto = prior + 1;
      gameMap.set(pa.batter_id, tto);
      ttoByPa.set(`${pa.game_date}:${pa.at_bat_number}`, tto);
    }

    // Step 2: walk every pitch, find its PA's TTO, and update the right bucket.
    const buckets: Record<'tto1' | 'tto2' | 'tto3plus', Bucket> = {
      tto1: newBucket('1st TTO'),
      tto2: newBucket('2nd TTO'),
      tto3plus: newBucket('3rd+ TTO'),
    };

    // Track which PAs we've already counted (a PA has many pitches but
    // only one event — the PA-ending pitch. We want per-PA K/BB rates, so
    // we dedupe by PA id.)
    const paEventSeen = new Set<string>();

    for (const pitch of pitches) {
      if (pitch.at_bat_number == null || !pitch.game_date) continue;
      const paId = `${pitch.game_date}:${pitch.at_bat_number}`;
      const tto = ttoByPa.get(paId);
      if (tto == null) continue;

      const key = tto === 1 ? 'tto1' : tto === 2 ? 'tto2' : 'tto3plus';
      const bucket = buckets[key];

      // PA-level counters: only register once per PA (via the PA-ending event row).
      const event = pitch.events ?? '';
      if (event && !paEventSeen.has(paId)) {
        paEventSeen.add(paId);
        bucket.paCount += 1;
        if (STRIKEOUT_EVENTS.has(event)) bucket.strikeouts += 1;
        if (WALK_EVENTS.has(event)) bucket.walks += 1;
        if (pitch.estimated_woba != null) {
          bucket.xwobaSum += pitch.estimated_woba;
          bucket.xwobaN += 1;
        }
      }

      // Pitch-level counter: FB velo averages over every fastball thrown in the bucket.
      if (FB_PITCH_TYPES.has(pitch.pitch_type) && pitch.release_speed) {
        bucket.fbVelos.push(pitch.release_speed);
      }
    }

    const formatBucket = (b: Bucket) => ({
      Pass: b.label,
      PAs: b.paCount,
      'K %': b.paCount > 0 ? ((b.strikeouts / b.paCount) * 100).toFixed(1) + '%' : '—',
      'BB %': b.paCount > 0 ? ((b.walks / b.paCount) * 100).toFixed(1) + '%' : '—',
      xwOBA: b.xwobaN > 0 ? (b.xwobaSum / b.xwobaN).toFixed(3) : '—',
      'Avg FB Velo':
        b.fbVelos.length > 0
          ? (b.fbVelos.reduce((s, v) => s + v, 0) / b.fbVelos.length).toFixed(1) + ' mph'
          : '—',
    });

    return [formatBucket(buckets.tto1), formatBucket(buckets.tto2), formatBucket(buckets.tto3plus)];
  },
};

registerTemplate(template);
