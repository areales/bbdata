import { registerTemplate, type QueryTemplate } from './registry.js';
import type { PitchData } from '../../adapters/types.js';
import { pitchTypeName } from '../../adapters/types.js';
import { assertFields } from '../../utils/validate-records.js';

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
        const swings = group.filter((p) =>
          p.description.includes('swing') || p.description.includes('foul'),
        );
        const whiffs = group.filter((p) =>
          p.description.includes('swinging_strike'),
        );
        const twoStrikes = group.filter((p) =>
          p.description.includes('strikeout') || p.description.includes('swinging_strike'),
        );

        return {
          'Pitch Type': pitchTypeName(type),
          'Usage %': ((count / total) * 100).toFixed(1) + '%',
          'Avg Velo': (group.reduce((s, p) => s + p.release_speed, 0) / count).toFixed(1) + ' mph',
          'Avg Spin': Math.round(group.reduce((s, p) => s + p.release_spin_rate, 0) / count) + ' rpm',
          'H Break': (group.reduce((s, p) => s + p.pfx_x, 0) / count).toFixed(1) + ' in',
          'V Break': (group.reduce((s, p) => s + p.pfx_z, 0) / count).toFixed(1) + ' in',
          'Whiff %': swings.length > 0
            ? ((whiffs.length / swings.length) * 100).toFixed(1) + '%'
            : '—',
          'Put Away %': twoStrikes.length > 0
            ? ((whiffs.length / count) * 100).toFixed(1) + '%'
            : '—',
          'Pitches': count,
        };
      })
      .sort((a, b) => (b.Pitches as number) - (a.Pitches as number));
  },
};

registerTemplate(template);
