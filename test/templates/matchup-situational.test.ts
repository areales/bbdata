import { describe, it, expect } from 'vitest';
import type { PlayerStats } from '../../src/adapters/types.js';

import '../../src/templates/queries/index.js';
import { getTemplate } from '../../src/templates/queries/registry.js';

const template = getTemplate('matchup-situational')!;

function statsRow(
  stats: Record<string, unknown>,
  split?: { code: string; description: string },
): PlayerStats {
  return {
    player_id: '518692',
    player_name: 'Freddie Freeman',
    team: 'LAD',
    season: 2025,
    stat_type: 'batting',
    stats: stats as PlayerStats['stats'],
    ...(split ? { split } : {}),
  };
}

describe('matchup-situational template', () => {
  it('buildQuery requests the situational split codes (P2.7 regression)', () => {
    const q = template.buildQuery({ player: 'Freddie Freeman', season: 2025 });
    expect(q.sit_codes).toEqual(['risp', 'risp2', 'r0', 'lc', 'ig01', 'ig07']);
    expect(q.stat_type).toBe('batting');
  });

  it('renders Overall plus one row per split, in display order', () => {
    // The template used to return exactly one Overall row — its stated
    // purpose (the situational splits) never came back.
    const input = [
      statsRow({ plateAppearances: 336, avg: '.270', obp: '.315', slg: '.451', strikeOuts: 72, baseOnBalls: 19 }, { code: 'r0', description: 'Bases Empty' }),
      statsRow({ plateAppearances: 627, avg: '.295', obp: '.367', slg: '.502', strikeOuts: 128, baseOnBalls: 56 }),
      statsRow({ plateAppearances: 161, avg: '.323', obp: '.447', slg: '.532', strikeOuts: 34, baseOnBalls: 29 }, { code: 'risp', description: 'Scoring Position' }),
      statsRow({ plateAppearances: 69, avg: '.255', obp: '.391', slg: '.327', strikeOuts: 14, baseOnBalls: 12 }, { code: 'lc', description: 'Late / Close' }),
    ];
    const rows = template.transform(input, { player: 'Freddie Freeman' });

    expect(rows.map((r) => r.Situation)).toEqual([
      'Overall',
      'Scoring Position',
      'Bases Empty',
      'Late / Close',
    ]);

    const risp = rows[1];
    expect(risp.PA).toBe(161);
    expect(risp.AVG).toBe('0.323');
    expect(risp['K %']).toBe('21.1%'); // 34 / 161
  });

  it('degrades to a single Overall row on a plain stdin PlayerStats payload', () => {
    const input = [
      statsRow({ plateAppearances: 600, avg: '.300', obp: '.380', slg: '.500', strikeOuts: 100, baseOnBalls: 60 }),
    ];
    const rows = template.transform(input, { player: 'Freddie Freeman' });
    expect(rows).toHaveLength(1);
    expect(rows[0].Situation).toBe('Overall');
  });

  it('throws the actionable assertFields error on pitch-level input (P4.7 regression)', () => {
    // Feeding a Savant pitch-level payload used to crash with
    // "Cannot read properties of undefined (reading 'plateAppearances')".
    const pitchLevel = [{ pitcher_id: '1', pitch_type: 'FF' } as unknown as PlayerStats];
    expect(() => template.transform(pitchLevel, { player: 'X' })).toThrow(
      /"matchup-situational".*"stats"/,
    );
  });
});
