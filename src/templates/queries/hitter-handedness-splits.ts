import { registerTemplate, type QueryTemplate } from './registry.js';
import { assertFields } from '../../utils/validate-records.js';
import type { PitchData } from '../../adapters/types.js';


const REQUIRED_FIELDS = ['p_throws', 'description'];

const template: QueryTemplate = {
  id: 'hitter-handedness-splits',
  name: 'Hitter Handedness Splits',
  category: 'hitter',
  description: 'Performance splits vs LHP and RHP — BA, SLG, K%, BB%, exit velocity, whiff rate',
  preferredSources: ['savant', 'fangraphs'],
  requiredParams: ['player'],
  optionalParams: ['season'],
  examples: [
    'bbdata query hitter-handedness-splits --player "Aaron Judge" --season 2025',
  ],

  buildQuery(params) {
    return {
      player_name: params.player,
      season: params.season ?? new Date().getFullYear(),
      stat_type: 'batting',
    };
  },

  columns() {
    return ['vs', 'PA', 'AVG', 'SLG', 'K %', 'BB %', 'Avg EV', 'Whiff %'];
  },

  transform(data) {
    const pitches = data as PitchData[];
    if (pitches.length === 0) return [];
    assertFields(pitches, REQUIRED_FIELDS, 'hitter-handedness-splits');


    return (['L', 'R'] as const).map((hand) => {
      const group = pitches.filter((p) => p.p_throws === hand);
      if (group.length === 0) {
        return { vs: `vs ${hand}HP`, PA: 0, AVG: '—', SLG: '—', 'K %': '—', 'BB %': '—', 'Avg EV': '—', 'Whiff %': '—' };
      }

      // Plate appearances (approximate: count events)
      const pas = group.filter((p) => p.events !== null);
      const hits = pas.filter((p) =>
        ['single', 'double', 'triple', 'home_run'].includes(p.events ?? ''),
      );
      const strikeouts = pas.filter((p) => p.events === 'strikeout');
      const walks = pas.filter((p) => ['walk', 'hit_by_pitch'].includes(p.events ?? ''));

      // Exit velocity on contact
      const contacted = group.filter((p) => p.launch_speed !== null && p.launch_speed > 0);
      const avgEv = contacted.length > 0
        ? contacted.reduce((s, p) => s + (p.launch_speed ?? 0), 0) / contacted.length
        : null;

      // Total bases for SLG
      const totalBases = pas.reduce((sum, p) => {
        if (p.events === 'single') return sum + 1;
        if (p.events === 'double') return sum + 2;
        if (p.events === 'triple') return sum + 3;
        if (p.events === 'home_run') return sum + 4;
        return sum;
      }, 0);

      // Whiff rate
      const swings = group.filter((p) =>
        p.description.includes('swing') || p.description.includes('foul'),
      );
      const whiffs = group.filter((p) => p.description.includes('swinging_strike'));

      return {
        vs: `vs ${hand}HP`,
        PA: pas.length,
        AVG: pas.length > 0 ? (hits.length / pas.length).toFixed(3) : '—',
        SLG: pas.length > 0 ? (totalBases / pas.length).toFixed(3) : '—',
        'K %': pas.length > 0 ? ((strikeouts.length / pas.length) * 100).toFixed(1) + '%' : '—',
        'BB %': pas.length > 0 ? ((walks.length / pas.length) * 100).toFixed(1) + '%' : '—',
        'Avg EV': avgEv !== null ? avgEv.toFixed(1) + ' mph' : '—',
        'Whiff %': swings.length > 0 ? ((whiffs.length / swings.length) * 100).toFixed(1) + '%' : '—',
      };
    });
  },
};

registerTemplate(template);
