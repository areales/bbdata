import { registerTemplate, type QueryTemplate } from './registry.js';
import type { PitchData } from '../../adapters/types.js';

/**
 * Pitcher Recent Form
 *
 * Groups pitch-level Statcast data by `game_date` and returns per-start
 * summary rows for the most recent 5 starts. Used by the advance-sp
 * report's "Recent Form" section (BBDATA-011).
 *
 * IP is computed from `inning` + `outs_when_up` when those fields are
 * present on the pitch rows (they're part of the BBDATA-011 PitchData
 * extension); when they're not, IP degrades to a count of out-generating
 * `events` strings, which is less accurate but still directionally
 * useful.
 *
 * ER is deliberately omitted — earned/unearned requires error tracking
 * that is not in Statcast, and approximating ER from `events` alone
 * mis-attributes inherited runners. The advance-sp template renders a
 * footnote pointing users to box scores for earned-run totals.
 */

const OUT_EVENT_COUNTS: Record<string, number> = {
  // One out
  field_out: 1,
  force_out: 1,
  strikeout: 1,
  sac_fly: 1,
  sac_bunt: 1,
  fielders_choice_out: 1,
  other_out: 1,
  // Two outs
  grounded_into_double_play: 2,
  double_play: 2,
  strikeout_double_play: 2,
  sac_fly_double_play: 2,
  // Three outs
  triple_play: 3,
  strikeout_triple_play: 3,
};

const HIT_EVENTS = new Set(['single', 'double', 'triple', 'home_run']);
const WALK_EVENTS = new Set(['walk', 'hit_by_pitch']);
const STRIKEOUT_EVENTS = new Set(['strikeout', 'strikeout_double_play', 'strikeout_triple_play']);
const FB_PITCH_TYPES = new Set(['FF', 'SI', 'FC']);

function formatIP(outs: number): string {
  // Baseball innings are expressed as X.Y where Y is the number of outs
  // recorded in the partial inning (0, 1, or 2). E.g. 5.2 = 5⅔ IP.
  const full = Math.floor(outs / 3);
  const partial = outs % 3;
  return `${full}.${partial}`;
}

interface GameAggregate {
  game_date: string;
  pitches: number;
  hits: number;
  walks: number;
  strikeouts: number;
  outsFromEvents: number;
  // For the inning-based IP path: the highest (inning, outs_when_up + outsRecorded)
  // we've seen per half-inning. Stored as a set of "inning:outs" strings we
  // can sum at the end.
  lastOutsPerHalf: Map<number, number>;
  fbVelos: number[];
}

const template: QueryTemplate = {
  id: 'pitcher-recent-form',
  name: 'Pitcher Recent Form',
  category: 'pitcher',
  description: 'Last 5 starts — per-game summary (IP, H, K, BB/HBP, pitches, fastball velo)',
  preferredSources: ['savant'],
  requiredParams: ['player'],
  optionalParams: ['season'],
  examples: [
    'bbdata query pitcher-recent-form --player "Tarik Skubal" --season 2024',
  ],

  buildQuery(params) {
    return {
      player_name: params.player,
      season: params.season ?? new Date().getFullYear(),
      stat_type: 'pitching',
    };
  },

  columns() {
    return ['Date', 'IP', 'H', 'K', 'BB/HBP', 'Pitches', 'Avg FB', 'Max Velo'];
  },

  transform(data) {
    const pitches = data as PitchData[];
    if (pitches.length === 0) return [];

    const byGame = new Map<string, GameAggregate>();

    for (const pitch of pitches) {
      if (!pitch.game_date) continue;

      let agg = byGame.get(pitch.game_date);
      if (!agg) {
        agg = {
          game_date: pitch.game_date,
          pitches: 0,
          hits: 0,
          walks: 0,
          strikeouts: 0,
          outsFromEvents: 0,
          lastOutsPerHalf: new Map<number, number>(),
          fbVelos: [],
        };
        byGame.set(pitch.game_date, agg);
      }

      agg.pitches += 1;

      const event = pitch.events ?? '';
      if (event) {
        if (HIT_EVENTS.has(event)) agg.hits += 1;
        if (WALK_EVENTS.has(event)) agg.walks += 1;
        if (STRIKEOUT_EVENTS.has(event)) agg.strikeouts += 1;
        const outs = OUT_EVENT_COUNTS[event];
        if (outs) agg.outsFromEvents += outs;

        // Inning-aware IP tracking: when the PA-ending pitch has both
        // `inning` and `outs_when_up`, we can derive the running out
        // count per half-inning. We ignore the top/bottom distinction
        // because a pitcher can only be in one half per inning, and
        // we're grouping by pitcher anyway.
        if (pitch.inning != null && pitch.outs_when_up != null && outs) {
          const outsAfterPa = pitch.outs_when_up + outs;
          const prev = agg.lastOutsPerHalf.get(pitch.inning) ?? 0;
          if (outsAfterPa > prev) {
            agg.lastOutsPerHalf.set(pitch.inning, outsAfterPa);
          }
        }
      }

      if (FB_PITCH_TYPES.has(pitch.pitch_type) && pitch.release_speed) {
        agg.fbVelos.push(pitch.release_speed);
      }
    }

    const rows = Array.from(byGame.values()).map((agg) => {
      // Prefer inning-based IP when we have per-inning out data for at
      // least one inning; otherwise fall back to events counting.
      let totalOuts = 0;
      if (agg.lastOutsPerHalf.size > 0) {
        for (const outs of agg.lastOutsPerHalf.values()) {
          totalOuts += Math.min(outs, 3);
        }
      } else {
        totalOuts = agg.outsFromEvents;
      }

      const avgFb =
        agg.fbVelos.length > 0
          ? agg.fbVelos.reduce((s, v) => s + v, 0) / agg.fbVelos.length
          : null;
      const maxVelo = agg.fbVelos.length > 0 ? Math.max(...agg.fbVelos) : null;

      return {
        Date: agg.game_date,
        IP: formatIP(totalOuts),
        H: agg.hits,
        K: agg.strikeouts,
        'BB/HBP': agg.walks,
        Pitches: agg.pitches,
        'Avg FB': avgFb != null ? `${avgFb.toFixed(1)} mph` : '—',
        'Max Velo': maxVelo != null ? `${maxVelo.toFixed(1)} mph` : '—',
      };
    });

    // Sort descending by date, take last 5 starts
    rows.sort((a, b) => (a.Date < b.Date ? 1 : a.Date > b.Date ? -1 : 0));
    return rows.slice(0, 5);
  },
};

registerTemplate(template);
