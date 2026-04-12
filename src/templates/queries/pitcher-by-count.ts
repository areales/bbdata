import { registerTemplate, type QueryTemplate } from './registry.js';
import type { PitchData } from '../../adapters/types.js';
import { pitchTypeName } from '../../adapters/types.js';

/**
 * Pitcher — By Count
 *
 * Buckets every pitch into one of four count states based on the
 * `balls`/`strikes` fields of the pitch row (part of the BBDATA-011
 * PitchData extension), then returns usage/whiff/primary-pitch/xwOBA
 * per bucket. Used by the advance-sp report's "By Count" section.
 *
 * Bucket definitions:
 *   ahead      — balls < strikes  (pitcher controls the PA)
 *   even       — balls === strikes
 *   behind     — balls > strikes  (pitcher must throw a strike)
 *   two-strike — strikes === 2    (overlay: intersects the above three)
 *
 * The two-strike row is explicitly labeled "Two-strike (overlay)" so
 * consumers understand it is not a disjoint bucket. Usage% sums across
 * ahead/even/behind will equal 100%; the two-strike overlay is
 * reported separately with its own usage% of total pitches.
 *
 * Rows with null `balls` or `strikes` are skipped (these come from
 * older CSV fixtures or stdin payloads written before the schema
 * extension).
 */

type BucketKey = 'ahead' | 'even' | 'behind' | 'twoStrike';

interface Bucket {
  label: string;
  count: number;
  swings: number;
  whiffs: number;
  xwobaSum: number;
  xwobaN: number;
  pitchTypeCounts: Map<string, number>;
}

function newBucket(label: string): Bucket {
  return {
    label,
    count: 0,
    swings: 0,
    whiffs: 0,
    xwobaSum: 0,
    xwobaN: 0,
    pitchTypeCounts: new Map(),
  };
}

function primaryPitch(b: Bucket): string {
  if (b.pitchTypeCounts.size === 0) return '—';
  let topType = '';
  let topCount = -1;
  for (const [type, n] of b.pitchTypeCounts) {
    if (n > topCount) {
      topCount = n;
      topType = type;
    }
  }
  return pitchTypeName(topType);
}

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

const template: QueryTemplate = {
  id: 'pitcher-by-count',
  name: 'Pitcher Pitch Usage by Count',
  category: 'pitcher',
  description: 'Pitch usage, whiff rate, primary pitch, and xwOBA by count state (ahead / even / behind / two-strike overlay)',
  preferredSources: ['savant'],
  requiredParams: ['player'],
  optionalParams: ['season'],
  examples: [
    'bbdata query pitcher-by-count --player "Tarik Skubal" --season 2024',
  ],

  buildQuery(params) {
    return {
      player_name: params.player,
      season: params.season ?? new Date().getFullYear(),
      stat_type: 'pitching',
    };
  },

  columns() {
    return ['Count State', 'Pitches', 'Usage %', 'Whiff %', 'Primary Pitch', 'xwOBA'];
  },

  transform(data) {
    const pitches = data as PitchData[];
    if (pitches.length === 0) return [];

    const buckets: Record<BucketKey, Bucket> = {
      ahead: newBucket('Ahead'),
      even: newBucket('Even'),
      behind: newBucket('Behind'),
      twoStrike: newBucket('Two-strike (overlay)'),
    };

    // Non-overlay pitches are counted toward the ahead/even/behind denominator.
    // Two-strike pitches count toward their own separate denominator (all pitches).
    let nonOverlayTotal = 0;
    let grandTotal = 0;

    for (const pitch of pitches) {
      if (pitch.balls == null || pitch.strikes == null) continue;
      grandTotal += 1;

      // Non-overlay bucket
      let primaryKey: BucketKey;
      if (pitch.balls < pitch.strikes) primaryKey = 'ahead';
      else if (pitch.balls > pitch.strikes) primaryKey = 'behind';
      else primaryKey = 'even';

      addToBucket(buckets[primaryKey], pitch);
      nonOverlayTotal += 1;

      // Overlay bucket
      if (pitch.strikes === 2) {
        addToBucket(buckets.twoStrike, pitch);
      }
    }

    if (grandTotal === 0) return [];

    const formatBucket = (key: BucketKey) => {
      const b = buckets[key];
      // Non-overlay buckets use nonOverlayTotal as denominator so ahead+even+behind = 100%.
      // Overlay bucket uses grandTotal so its Usage% reads as "X% of all pitches".
      const denom = key === 'twoStrike' ? grandTotal : nonOverlayTotal;
      return {
        'Count State': b.label,
        Pitches: b.count,
        'Usage %': denom > 0 ? ((b.count / denom) * 100).toFixed(1) + '%' : '—',
        'Whiff %':
          b.swings > 0 ? ((b.whiffs / b.swings) * 100).toFixed(1) + '%' : '—',
        'Primary Pitch': primaryPitch(b),
        xwOBA: b.xwobaN > 0 ? (b.xwobaSum / b.xwobaN).toFixed(3) : '—',
      };
    };

    return [
      formatBucket('ahead'),
      formatBucket('even'),
      formatBucket('behind'),
      formatBucket('twoStrike'),
    ];
  },
};

function addToBucket(bucket: Bucket, pitch: PitchData): void {
  bucket.count += 1;
  if (pitch.pitch_type) {
    bucket.pitchTypeCounts.set(
      pitch.pitch_type,
      (bucket.pitchTypeCounts.get(pitch.pitch_type) ?? 0) + 1,
    );
  }
  if (SWING_DESCRIPTIONS.has(pitch.description)) {
    bucket.swings += 1;
    if (WHIFF_DESCRIPTIONS.has(pitch.description)) bucket.whiffs += 1;
  }
  if (pitch.estimated_woba != null) {
    bucket.xwobaSum += pitch.estimated_woba;
    bucket.xwobaN += 1;
  }
}

registerTemplate(template);
