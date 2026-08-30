import { describe, it, expect } from 'vitest';
import type { PlayerStats } from '../../src/adapters/types.js';

import '../../src/templates/queries/index.js';
import { getTemplate } from '../../src/templates/queries/registry.js';

const template = getTemplate('leaderboard-custom')!;

function player(name: string, stats: Record<string, unknown>): PlayerStats {
  return {
    player_id: name,
    player_name: name,
    team: 'NYY',
    season: 2025,
    stat_type: 'batting',
    stats: stats as PlayerStats['stats'],
  };
}

describe('leaderboard-custom template', () => {
  it('resolves course-vocabulary stat names against FanGraphs keys (P1.12 regression)', () => {
    // `barrel_rate` is the template's own first documented example and the
    // course lesson's showcase command — it used to match nothing and
    // masquerade as an adapter 0-row failure.
    const input = [
      player('A', { 'Barrel%': 0.155, PA: 600 }),
      player('B', { 'Barrel%': 0.101, PA: 580 }),
    ];
    const rows = template.transform(input, { stat: 'barrel_rate' });
    expect(rows).toHaveLength(2);
    expect(rows[0].Player).toBe('A');
    expect(rows[0].Rank).toBe(1);
    expect(rows[0]['barrel_rate']).toBe('15.5%');
  });

  it('throws an actionable error naming available stat keys for an unknown stat', () => {
    const input = [player('A', { HR: 53, AVG: 0.331 })];
    try {
      template.transform(input, { stat: 'nonsense_stat' });
      expect.fail('expected transform() to throw for an unresolvable stat');
    } catch (err) {
      const msg = (err as Error).message;
      expect(msg).toContain('"nonsense_stat" not found');
      expect(msg).toContain('AVG');
      expect(msg).toContain('HR');
    }
  });

  it('renders percent-keyed stats as percentages and others as decimals', () => {
    const pct = template.transform([player('A', { 'K%': 0.236 })], { stat: 'K%' });
    expect(pct[0]['K%']).toBe('23.6%');

    const avg = template.transform([player('A', { AVG: 0.331 })], { stat: 'AVG' });
    expect(avg[0]['AVG']).toBe('0.331');
  });

  it('sorts rate stats like ERA ascending', () => {
    const input = [
      player('High', { ERA: 4.5, IP: 150 }),
      player('Low', { ERA: 2.9, IP: 180 }),
    ];
    const rows = template.transform(input, { stat: 'ERA' });
    expect(rows[0].Player).toBe('Low');
  });
});
