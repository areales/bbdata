import { describe, it, expect } from 'vitest';

import '../../src/templates/queries/index.js';
import { getTemplate } from '../../src/templates/queries/registry.js';

/**
 * Regression guard for the P4.5 assertFields retrofit (commit f6989fa).
 *
 * Each of the nine templates below dereferences at least one field on its
 * input records via `.includes()` or direct comparison. Before the
 * retrofit, hand-authored stdin / --data payloads missing those fields
 * crashed with `TypeError: Cannot read properties of undefined` pointing
 * at the template instead of the input, or silently returned empty / NaN
 * rows.
 *
 * This file asserts the guard remains in place and the error names both
 * the template id and every missing field — a future edit that drops the
 * assertFields call on any of these templates will fail here.
 */

interface RetrofitCase {
  id: string;
  requiredFields: string[];
  params: Record<string, unknown>;
}

const cases: RetrofitCase[] = [
  { id: 'pitcher-velocity-trend',    requiredFields: ['pitch_type', 'release_speed', 'game_date'], params: { player: 'X' } },
  { id: 'trend-rolling-average',     requiredFields: ['game_date'],                                params: { player: 'X' } },
  { id: 'hitter-handedness-splits',  requiredFields: ['p_throws', 'description'],                  params: { player: 'X' } },
  { id: 'hitter-hot-cold-zones',     requiredFields: ['description'],                              params: { player: 'X' } },
  { id: 'hitter-vs-pitch-type',      requiredFields: ['description'],                              params: { player: 'X' } },
  { id: 'leaderboard-comparison',    requiredFields: ['player_name'],                              params: { players: ['A'] } },
  { id: 'leaderboard-custom',        requiredFields: ['player_name'],                              params: { stat: 'AVG' } },
  { id: 'matchup-pitcher-vs-hitter', requiredFields: ['batter_name'],                              params: { players: ['P', 'H'] } },
  { id: 'pitcher-handedness-splits', requiredFields: ['description', 'stand'],                     params: { player: 'X' } },
];

describe('assertFields retrofit (P4.5 opportunistic rollout)', () => {
  describe.each(cases)('$id', ({ id, requiredFields, params }) => {
    const template = getTemplate(id)!;

    it('is registered', () => {
      expect(template).toBeDefined();
      expect(template.id).toBe(id);
    });

    it('throws a clear error when records are missing every required field', () => {
      // Sentinel: a record with an unrelated field, so length > 0 reaches
      // assertFields but no required field is present.
      const sparse = [{ pitcher_id: '1' } as unknown as never];
      expect(() => template.transform(sparse, params as never)).toThrow(
        new RegExp(`"${id}"`),
      );
    });

    it('error message names every missing field in one pass', () => {
      const sparse = [{ pitcher_id: '1' } as unknown as never];
      try {
        template.transform(sparse, params as never);
        expect.fail(`expected ${id}.transform() to throw on sparse input`);
      } catch (err) {
        const msg = (err as Error).message;
        for (const field of requiredFields) {
          expect(
            msg,
            `expected error for "${id}" to name missing field "${field}"`,
          ).toContain(field);
        }
      }
    });
  });
});
