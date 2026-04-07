import { registerTemplate, type QueryTemplate } from './registry.js';
import type { PitchData } from '../../adapters/types.js';
import { pitchTypeName } from '../../adapters/types.js';

const template: QueryTemplate = {
  id: 'matchup-pitcher-vs-hitter',
  name: 'Pitcher vs Hitter Matchup',
  category: 'matchup',
  description: 'Career head-to-head history — PA, H, HR, BB, K, BA, SLG, most common pitches',
  preferredSources: ['savant'],
  requiredParams: ['players'], // expects [pitcher, hitter]
  optionalParams: ['season'],
  examples: [
    'bbdata query matchup-pitcher-vs-hitter --players "Gerrit Cole,Aaron Judge"',
  ],

  buildQuery(params) {
    // Query for the pitcher's data — we'll filter for the specific batter in transform
    return {
      player_name: params.players?.[0],
      season: params.season ?? new Date().getFullYear(),
      stat_type: 'pitching',
    };
  },

  columns() {
    return ['Metric', 'Value'];
  },

  transform(data, params) {
    const pitches = data as PitchData[];
    const hitterName = (params.players?.[1] ?? '').toLowerCase();

    // Filter to only PAs against the target hitter
    const matchup = pitches.filter((p) =>
      p.batter_name.toLowerCase().includes(hitterName),
    );

    if (matchup.length === 0) {
      return [{ Metric: 'Note', Value: `No matchup data found for ${params.players?.[1] ?? 'hitter'}` }];
    }

    const pas = matchup.filter((p) => p.events !== null);
    const hits = pas.filter((p) => ['single', 'double', 'triple', 'home_run'].includes(p.events ?? ''));
    const hrs = pas.filter((p) => p.events === 'home_run');
    const ks = pas.filter((p) => p.events === 'strikeout');
    const bbs = pas.filter((p) => ['walk', 'hit_by_pitch'].includes(p.events ?? ''));
    const totalBases = pas.reduce((sum, p) => {
      if (p.events === 'single') return sum + 1;
      if (p.events === 'double') return sum + 2;
      if (p.events === 'triple') return sum + 3;
      if (p.events === 'home_run') return sum + 4;
      return sum;
    }, 0);

    // Most common pitch types
    const pitchCounts = new Map<string, number>();
    for (const p of matchup) {
      pitchCounts.set(p.pitch_type, (pitchCounts.get(p.pitch_type) ?? 0) + 1);
    }
    const topPitches = Array.from(pitchCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([type, count]) => `${pitchTypeName(type)} (${count})`)
      .join(', ');

    return [
      { Metric: 'Total Pitches', Value: matchup.length },
      { Metric: 'Plate Appearances', Value: pas.length },
      { Metric: 'Hits', Value: hits.length },
      { Metric: 'Home Runs', Value: hrs.length },
      { Metric: 'Strikeouts', Value: ks.length },
      { Metric: 'Walks', Value: bbs.length },
      { Metric: 'AVG', Value: pas.length > 0 ? (hits.length / pas.length).toFixed(3) : '—' },
      { Metric: 'SLG', Value: pas.length > 0 ? (totalBases / pas.length).toFixed(3) : '—' },
      { Metric: 'Most Common Pitches', Value: topPitches },
    ];
  },
};

registerTemplate(template);
