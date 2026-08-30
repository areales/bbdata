import { registerTemplate, type QueryTemplate } from './registry.js';
import { assertFields } from '../../utils/validate-records.js';
import type { PitchData } from '../../adapters/types.js';
import { pitchTypeName } from '../../adapters/types.js';


const REQUIRED_FIELDS = ['batter_name'];

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
    // The savant adapter resolves opponent_name and filters server-side
    // (batters_lookup[]) — the live CSV has no batter-name column, so
    // the matchup cannot be reconstructed client-side (P1.8).
    return {
      player_name: params.players?.[0],
      opponent_name: params.players?.[1],
      season: params.season ?? new Date().getFullYear(),
      stat_type: 'pitching',
    };
  },

  columns() {
    return ['Metric', 'Value'];
  },

  transform(data, params) {
    const pitches = data as PitchData[];
    if (pitches.length === 0) return [];
    assertFields(pitches, REQUIRED_FIELDS, 'matchup-pitcher-vs-hitter');

    const hitterName = (params.players?.[1] ?? '').toLowerCase();

    // Name filter serves stdin / --data payloads that carry batter_name.
    let matchup = pitches.filter((p) =>
      p.batter_name.toLowerCase().includes(hitterName),
    );

    // Live Savant payloads have no batter names (every row falls back to
    // "Unknown (#id)"), but the adapter already filtered server-side to
    // the matchup — a single-batter payload is the matchup (P1.8).
    if (matchup.length === 0) {
      const batterIds = new Set(pitches.map((p) => p.batter_id));
      if (batterIds.size === 1) {
        matchup = pitches;
      }
    }

    if (matchup.length === 0) {
      return [{ Metric: 'Note', Value: `No matchup data found for ${params.players?.[1] ?? 'hitter'}` }];
    }

    const pas = matchup.filter((p) => p.events !== null);
    const hits = pas.filter((p) => ['single', 'double', 'triple', 'home_run'].includes(p.events ?? ''));
    const hrs = pas.filter((p) => p.events === 'home_run');
    const ks = pas.filter((p) => p.events === 'strikeout');
    const bbs = pas.filter((p) => ['walk', 'intent_walk', 'hit_by_pitch'].includes(p.events ?? ''));
    // AVG/SLG are per at-bat, not per plate appearance — walks and sac
    // flies don't belong in the denominator (same convention as
    // hitter-vs-pitch-type).
    const abs = pas.filter(
      (p) => !['walk', 'intent_walk', 'hit_by_pitch', 'sac_fly', 'sac_bunt'].includes(p.events ?? ''),
    );
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
      { Metric: 'AVG', Value: abs.length > 0 ? (hits.length / abs.length).toFixed(3) : '—' },
      { Metric: 'SLG', Value: abs.length > 0 ? (totalBases / abs.length).toFixed(3) : '—' },
      { Metric: 'Most Common Pitches', Value: topPitches },
    ];
  },
};

registerTemplate(template);
