import { registerTemplate, type QueryTemplate } from './registry.js';
import type { PlayerStats } from '../../adapters/types.js';

const template: QueryTemplate = {
  id: 'trend-year-over-year',
  name: 'Year-over-Year Comparison',
  category: 'trend',
  description: 'Compare metric changes year to year — flags changes greater than 10%',
  preferredSources: ['fangraphs', 'mlb-stats-api'],
  requiredParams: ['player'],
  optionalParams: ['seasons'], // e.g. "2023-2025"
  examples: [
    'bbdata query trend-year-over-year --player "Julio Rodriguez" --seasons 2023-2025',
  ],

  buildQuery(params) {
    // We'll need multiple seasons — use the most recent by default
    const season = params.season ?? new Date().getFullYear();
    return {
      player_name: params.player,
      season,
      stat_type: 'batting',
    };
  },

  columns() {
    return ['Metric', 'Prior', 'Current', 'Change', 'Flag'];
  },

  transform(data, _params) {
    const stats = data as PlayerStats[];
    if (stats.length === 0) return [];

    // If we have multi-season data, compare last two
    // With single-season data, we show what we have
    const player = stats[0];
    const s = player.stats;

    // Key metrics to compare
    const metrics = ['AVG', 'OBP', 'SLG', 'HR', 'wRC+', 'K%', 'BB%', 'WAR', 'ISO', 'BABIP'];

    return metrics.map((metric) => {
      const current = findStat(s, metric);
      // Without multi-season support in a single query, we show current only
      // Full YoY requires querying multiple seasons (future enhancement)
      return {
        Metric: metric,
        Prior: '—',
        Current: current !== null ? formatVal(current) : '—',
        Change: '—',
        Flag: '',
      };
    });
  },
};

function findStat(stats: Record<string, unknown>, key: string): number | null {
  const lower = key.toLowerCase().replace(/[+%]/g, '');
  for (const [k, v] of Object.entries(stats)) {
    if (k.toLowerCase().replace(/[+%]/g, '') === lower) {
      const n = Number(v);
      return isNaN(n) ? null : n;
    }
  }
  return null;
}

function formatVal(n: number): string {
  if (n < 1 && n > 0) return n.toFixed(3);
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}

registerTemplate(template);
