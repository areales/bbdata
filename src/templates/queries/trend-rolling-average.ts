import { registerTemplate, type QueryTemplate } from './registry.js';
import type { PitchData } from '../../adapters/types.js';

const template: QueryTemplate = {
  id: 'trend-rolling-average',
  name: 'Season Trend (Rolling Average)',
  category: 'trend',
  description: '15-game (hitters) or 5-start (pitchers) rolling averages — identifies sustained trends',
  preferredSources: ['savant'],
  requiredParams: ['player'],
  optionalParams: ['season'],
  examples: [
    'bbdata query trend-rolling-average --player "Freddie Freeman" --season 2025',
  ],

  buildQuery(params) {
    return {
      player_name: params.player,
      season: params.season ?? new Date().getFullYear(),
      stat_type: 'batting',
    };
  },

  columns() {
    return ['Window', 'Games', 'AVG', 'SLG', 'K %', 'Avg EV', 'Hard Hit %'];
  },

  transform(data) {
    const pitches = data as PitchData[];
    if (pitches.length === 0) return [];

    // Group by game date
    const byDate = new Map<string, PitchData[]>();
    for (const p of pitches) {
      const group = byDate.get(p.game_date) ?? [];
      group.push(p);
      byDate.set(p.game_date, group);
    }

    const dates = Array.from(byDate.keys()).sort();
    const windowSize = 15;

    if (dates.length < windowSize) {
      return [{ Window: 'Insufficient data', Games: dates.length, AVG: '—', SLG: '—', 'K %': '—', 'Avg EV': '—', 'Hard Hit %': '—' }];
    }

    // Calculate rolling windows
    const results: Record<string, unknown>[] = [];

    for (let i = 0; i <= dates.length - windowSize; i += Math.max(1, Math.floor(windowSize / 3))) {
      const windowDates = dates.slice(i, i + windowSize);
      const windowPitches = windowDates.flatMap((d) => byDate.get(d) ?? []);

      const pas = windowPitches.filter((p) => p.events !== null);
      const hits = pas.filter((p) => ['single', 'double', 'triple', 'home_run'].includes(p.events ?? ''));
      const ks = pas.filter((p) => p.events === 'strikeout');
      const totalBases = pas.reduce((sum, p) => {
        if (p.events === 'single') return sum + 1;
        if (p.events === 'double') return sum + 2;
        if (p.events === 'triple') return sum + 3;
        if (p.events === 'home_run') return sum + 4;
        return sum;
      }, 0);

      const batted = windowPitches.filter((p) => p.launch_speed !== null && p.launch_speed > 0);
      const avgEv = batted.length > 0
        ? batted.reduce((s, p) => s + p.launch_speed!, 0) / batted.length
        : null;
      const hardHit = batted.filter((p) => p.launch_speed! >= 95).length;

      results.push({
        Window: `${windowDates[0]} → ${windowDates[windowDates.length - 1]}`,
        Games: windowDates.length,
        AVG: pas.length > 0 ? (hits.length / pas.length).toFixed(3) : '—',
        SLG: pas.length > 0 ? (totalBases / pas.length).toFixed(3) : '—',
        'K %': pas.length > 0 ? ((ks.length / pas.length) * 100).toFixed(1) + '%' : '—',
        'Avg EV': avgEv !== null ? avgEv.toFixed(1) + ' mph' : '—',
        'Hard Hit %': batted.length > 0 ? ((hardHit / batted.length) * 100).toFixed(1) + '%' : '—',
      });
    }

    return results;
  },
};

registerTemplate(template);
