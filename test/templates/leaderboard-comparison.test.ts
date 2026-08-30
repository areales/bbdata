import { describe, it, expect } from 'vitest';
import type { PlayerStats } from '../../src/adapters/types.js';

import '../../src/templates/queries/index.js';
import { getTemplate } from '../../src/templates/queries/registry.js';

describe('leaderboard-comparison template', () => {
  const template = getTemplate('leaderboard-comparison')!;

  // FanGraphs rows carry both the counting and rate forms of a stat, with
  // the counting form iterating first — the collision behind P1.10/P1.17.
  const makePlayer = (name: string, stats: Record<string, number>): PlayerStats => ({
    player_id: '592450',
    player_name: name,
    team: 'NYY',
    season: 2025,
    stat_type: 'batting',
    stats,
  });

  it('is registered', () => {
    expect(template).toBeDefined();
    expect(template.id).toBe('leaderboard-comparison');
  });

  it('prefers the exact BB% key over the BB walk total (P1.10 regression)', () => {
    const input = [
      makePlayer('Aaron Judge', { BB: 127, 'BB%': 0.185, SO: 132, 'K%': 0.236 }),
    ];
    const rows = template.transform(input, { players: ['Aaron Judge'] });
    const byMetric = new Map(rows.map((r) => [r.Metric, r['Aaron Judge']]));
    expect(byMetric.get('BB%')).toBe('0.185');
    expect(byMetric.get('K%')).toBe('0.236');
  });

  it('prefers the exact wRC+ key over the wRC counting stat (P1.17 regression)', () => {
    const input = [
      makePlayer('Aaron Judge', { wRC: 162.8, 'wRC+': 204 }),
    ];
    const rows = template.transform(input, { players: ['Aaron Judge'] });
    const byMetric = new Map(rows.map((r) => [r.Metric, r['Aaron Judge']]));
    expect(byMetric.get('wRC+')).toBe('204');
  });

  it('still falls back to a normalized key match when no exact key exists', () => {
    const input = [
      makePlayer('Aaron Judge', { 'bb%': 0.185 }),
    ];
    const rows = template.transform(input, { players: ['Aaron Judge'] });
    const byMetric = new Map(rows.map((r) => [r.Metric, r['Aaron Judge']]));
    expect(byMetric.get('BB%')).toBe('0.185');
  });

  it('renders em-dash for unmatched players', () => {
    const input = [
      makePlayer('Aaron Judge', { HR: 53 }),
    ];
    const rows = template.transform(input, { players: ['Aaron Judge', 'Nobody Real'] });
    const hrRow = rows.find((r) => r.Metric === 'HR')!;
    expect(hrRow['Aaron Judge']).toBe('53');
    expect(hrRow['Nobody Real']).toBe('—');
  });
});
