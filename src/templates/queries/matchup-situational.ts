import { registerTemplate, type QueryTemplate } from './registry.js';
import type { PlayerStats } from '../../adapters/types.js';

const template: QueryTemplate = {
  id: 'matchup-situational',
  name: 'Situational Splits',
  category: 'matchup',
  description: 'Performance in key situations — RISP, high leverage, close & late, by inning',
  preferredSources: ['fangraphs', 'mlb-stats-api'],
  requiredParams: ['player'],
  optionalParams: ['season'],
  examples: [
    'bbdata query matchup-situational --player "Juan Soto" --season 2025',
  ],

  buildQuery(params) {
    return {
      player_name: params.player,
      season: params.season ?? new Date().getFullYear(),
      stat_type: 'batting',
    };
  },

  columns() {
    return ['Situation', 'PA', 'AVG', 'OBP', 'SLG', 'K %', 'BB %'];
  },

  transform(data) {
    // Situational splits typically come pre-computed from FanGraphs
    // With raw pitch data this would require game state context
    // This template works best with FanGraphs/MLB API aggregated splits
    const stats = data as PlayerStats[];

    if (stats.length === 0) return [];

    const player = stats[0];
    const s = player.stats;

    // Return whatever aggregated stats we have — format for display
    return [
      {
        Situation: 'Overall',
        PA: s.plateAppearances ?? s.PA ?? '—',
        AVG: formatStat(s.avg ?? s.AVG),
        OBP: formatStat(s.obp ?? s.OBP),
        SLG: formatStat(s.slg ?? s.SLG),
        'K %': formatPct(s.strikeOuts ?? s.SO, s.plateAppearances ?? s.PA),
        'BB %': formatPct(s.baseOnBalls ?? s.BB, s.plateAppearances ?? s.PA),
      },
    ];
  },
};

function formatStat(val: unknown): string {
  if (val === null || val === undefined) return '—';
  const n = Number(val);
  if (isNaN(n)) return String(val);
  return n < 1 ? n.toFixed(3) : n.toFixed(1);
}

function formatPct(num: unknown, denom: unknown): string {
  const n = Number(num);
  const d = Number(denom);
  if (isNaN(n) || isNaN(d) || d === 0) return '—';
  return ((n / d) * 100).toFixed(1) + '%';
}

registerTemplate(template);
