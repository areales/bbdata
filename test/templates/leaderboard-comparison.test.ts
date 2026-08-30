import { describe, it, expect } from 'vitest';
import type { PlayerStats } from '../../src/adapters/types.js';

import '../../src/templates/queries/index.js';
import { getTemplate } from '../../src/templates/queries/registry.js';

const template = getTemplate('leaderboard-comparison')!;

function judgeRow(stats: Record<string, unknown>): PlayerStats {
  return {
    player_id: '592450',
    player_name: 'Aaron Judge',
    team: 'NYY',
    season: 2025,
    stat_type: 'batting',
    stats: stats as PlayerStats['stats'],
  };
}

describe('leaderboard-comparison template', () => {
  it('is registered with the leaderboard category', () => {
    expect(template).toBeDefined();
    expect(template.category).toBe('leaderboard');
  });

  it('does not collide BB% with the raw BB walk count (P1.10 regression)', () => {
    // FanGraphs rows carry both keys, counting stats first — the old
    // %-stripping lookup matched `BB` (124 walks) for the BB% metric.
    const input = [judgeRow({ BB: 124, 'BB%': 0.188 })];
    const rows = template.transform(input, { players: ['Aaron Judge'] });
    const bbRow = rows.find((r) => r.Metric === 'BB%')!;
    expect(bbRow['Aaron Judge']).toBe('18.8%');
  });

  it('does not collide wRC+ with wRC (P1.17 regression)', () => {
    // The old lookup normalized `wRC+` to `wrc` and matched `wRC`
    // (weighted runs created, 162.8) instead of wRC+ (204).
    const input = [judgeRow({ wRC: 162.8, 'wRC+': 204 })];
    const rows = template.transform(input, { players: ['Aaron Judge'] });
    const wrcRow = rows.find((r) => r.Metric === 'wRC+')!;
    expect(wrcRow['Aaron Judge']).toBe('204');
  });

  it('renders rate stats as percentages and slash stats with 3 decimals', () => {
    const input = [
      judgeRow({
        AVG: 0.331,
        OBP: 0.457,
        SLG: 0.688,
        OPS: 1.145,
        'K%': 0.236,
        'BB%': 0.188,
      }),
    ];
    const rows = template.transform(input, { players: ['Aaron Judge'] });
    const byMetric = new Map(rows.map((r) => [r.Metric, r['Aaron Judge']]));
    expect(byMetric.get('AVG')).toBe('0.331');
    expect(byMetric.get('OPS')).toBe('1.145');
    expect(byMetric.get('K%')).toBe('23.6%');
    expect(byMetric.get('BB%')).toBe('18.8%');
  });

  it('resolves alias key variants (wRCplus, BB_pct, K_pct)', () => {
    const input = [judgeRow({ wRCplus: 204, BB_pct: 0.188, K_pct: 0.236 })];
    const rows = template.transform(input, { players: ['Aaron Judge'] });
    const byMetric = new Map(rows.map((r) => [r.Metric, r['Aaron Judge']]));
    expect(byMetric.get('wRC+')).toBe('204');
    expect(byMetric.get('BB%')).toBe('18.8%');
    expect(byMetric.get('K%')).toBe('23.6%');
  });

  it('renders em-dash for unmatched players and missing stats', () => {
    const input = [judgeRow({ AVG: 0.331 })];
    const rows = template.transform(input, {
      players: ['Aaron Judge', 'Nobody Realman'],
    });
    const avgRow = rows.find((r) => r.Metric === 'AVG')!;
    expect(avgRow['Aaron Judge']).toBe('0.331');
    expect(avgRow['Nobody Realman']).toBe('—');
    const warRow = rows.find((r) => r.Metric === 'WAR')!;
    expect(warRow['Aaron Judge']).toBe('—');
  });

  it('matches players by case-insensitive partial name', () => {
    const input = [judgeRow({ AVG: 0.331 })];
    const rows = template.transform(input, { players: ['aaron judge'] });
    const avgRow = rows.find((r) => r.Metric === 'AVG')!;
    expect(avgRow['aaron judge']).toBe('0.331');
  });
});
