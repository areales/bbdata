import { registerTemplate, type QueryTemplate } from './registry.js';
import type { PlayerStats } from '../../adapters/types.js';
import { assertFields } from '../../utils/validate-records.js';

const REQUIRED_FIELDS = ['stats'];

/**
 * Situational splits (P2.7). Fetches `stats=season,statSplits` through
 * the MLB Stats API adapter's `sit_codes` support — the season row
 * renders as "Overall" and each situation renders under its MLB
 * description. FanGraphs is not in the source chain: its leaderboard
 * API has no situational splits, which is why this template used to
 * return only an Overall row.
 *
 * Note: the MLB situation vocabulary has no leverage codes, so the
 * closest available splits are Late/Close and the innings buckets.
 */

// Display order. Codes from statsapi.mlb.com/api/v1/situationCodes.
const SIT_CODES = ['risp', 'risp2', 'r0', 'lc', 'ig01', 'ig07'];

const template: QueryTemplate = {
  id: 'matchup-situational',
  name: 'Situational Splits',
  category: 'matchup',
  description: 'Performance in key situations — RISP, bases empty, late & close, innings buckets',
  preferredSources: ['mlb-stats-api'],
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
      sit_codes: SIT_CODES,
    };
  },

  columns() {
    return ['Situation', 'PA', 'AVG', 'OBP', 'SLG', 'K %', 'BB %'];
  },

  transform(data) {
    const stats = data as PlayerStats[];
    if (stats.length === 0) return [];
    assertFields(stats, REQUIRED_FIELDS, 'matchup-situational');

    const toRow = (label: string, s: Record<string, unknown>) => ({
      Situation: label,
      PA: s.plateAppearances ?? s.PA ?? '—',
      AVG: formatStat(s.avg ?? s.AVG),
      OBP: formatStat(s.obp ?? s.OBP),
      SLG: formatStat(s.slg ?? s.SLG),
      'K %': formatPct(s.strikeOuts ?? s.SO, s.plateAppearances ?? s.PA),
      'BB %': formatPct(s.baseOnBalls ?? s.BB, s.plateAppearances ?? s.PA),
    });

    const rows: Record<string, unknown>[] = [];

    // Season-aggregate rows carry no split descriptor → Overall. A
    // stdin payload of plain PlayerStats degrades to this single row.
    const overall = stats.find((r) => !r.split);
    if (overall) {
      rows.push(toRow('Overall', overall.stats));
    }

    for (const code of SIT_CODES) {
      const row = stats.find((r) => r.split?.code === code);
      if (row) {
        rows.push(toRow(row.split!.description, row.stats));
      }
    }

    return rows;
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
