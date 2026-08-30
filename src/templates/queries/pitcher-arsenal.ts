import { registerTemplate, type QueryTemplate } from './registry.js';
import type { PitchData } from '../../adapters/types.js';
import { pitchTypeName } from '../../adapters/types.js';
import { assertFields } from '../../utils/validate-records.js';
import { meanOf } from '../../utils/aggregate.js';

const REQUIRED_FIELDS = [
  'description',
  'release_speed',
  'release_spin_rate',
  'pfx_x',
  'pfx_z',
];

const template: QueryTemplate = {
  id: 'pitcher-arsenal',
  name: 'Pitcher Arsenal Profile',
  category: 'pitcher',
  description: 'Pitch usage rates, velocity, spin, movement, and whiff rates by pitch type',
  preferredSources: ['savant', 'fangraphs', 'mlb-stats-api'],
  requiredParams: ['player'],
  optionalParams: ['season', 'pitchType'],
  examples: [
    'bbdata query pitcher-arsenal --player "Corbin Burnes" --season 2025',
    'bbdata query pitcher-arsenal --player "Spencer Strider"',
  ],

  buildQuery(params) {
    return {
      player_name: params.player,
      season: params.season ?? new Date().getFullYear(),
      stat_type: 'pitching',
      pitch_type: params.pitchType ? [params.pitchType] : undefined,
    };
  },

  columns() {
    return [
      'Pitch Type',
      'Usage %',
      'Avg Velo',
      'Avg Spin',
      'H Break',
      'V Break',
      'Whiff %',
      'Put Away %',
      'Pitches',
    ];
  },

  transform(data, _params) {
    const pitches = data as PitchData[];
    if (pitches.length === 0) return [];
    assertFields(pitches, REQUIRED_FIELDS, 'pitcher-arsenal');

    // Group by pitch type
    const byType = new Map<string, PitchData[]>();
    for (const pitch of pitches) {
      if (!pitch.pitch_type) continue;
      const group = byType.get(pitch.pitch_type) ?? [];
      group.push(pitch);
      byType.set(pitch.pitch_type, group);
    }

    const total = pitches.length;

    return Array.from(byType.entries())
      .map(([type, group]) => {
        const count = group.length;
        // Balls in play are swings: Statcast's description for them is
        // `hit_into_play`, which the old swing/foul substring pair missed,
        // inflating whiff % for every pitch of every pitcher (P1.7).
        const swings = group.filter((p) =>
          p.description.includes('swing') ||
          p.description.includes('foul') ||
          p.description.includes('hit_into_play'),
        );
        const whiffs = group.filter((p) =>
          p.description.includes('swinging_strike'),
        );
        // Put-away rate: strikeouts per two-strike pitch of this type.
        // `strikes` is the count before the pitch; `events` marks the
        // PA-ending pitch (`strikeout` / `strikeout_double_play`).
        // Absent count data (sparse stdin payloads) renders as —.
        const twoStrikePitches = group.filter((p) => p.strikes === 2);
        const putAways = twoStrikePitches.filter((p) =>
          p.events != null && p.events.startsWith('strikeout'),
        );

        const avgVelo = meanOf(group.map((p) => p.release_speed));
        const avgSpin = meanOf(group.map((p) => p.release_spin_rate));
        // pfx values are in feet; Savant publishes break in inches (P1.16)
        const hBreak = meanOf(group.map((p) => p.pfx_x));
        const vBreak = meanOf(group.map((p) => p.pfx_z));

        return {
          'Pitch Type': pitchTypeName(type),
          'Usage %': ((count / total) * 100).toFixed(1) + '%',
          'Avg Velo': avgVelo != null ? avgVelo.toFixed(1) + ' mph' : '—',
          'Avg Spin': avgSpin != null ? Math.round(avgSpin) + ' rpm' : '—',
          'H Break': hBreak != null ? (hBreak * 12).toFixed(1) + ' in' : '—',
          'V Break': vBreak != null ? (vBreak * 12).toFixed(1) + ' in' : '—',
          'Whiff %': swings.length > 0
            ? ((whiffs.length / swings.length) * 100).toFixed(1) + '%'
            : '—',
          'Put Away %': twoStrikePitches.length > 0
            ? ((putAways.length / twoStrikePitches.length) * 100).toFixed(1) + '%'
            : '—',
          'Pitches': count,
        };
      })
      .sort((a, b) => (b.Pitches as number) - (a.Pitches as number));
  },
};

registerTemplate(template);
