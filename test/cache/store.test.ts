import { describe, it, expect } from 'vitest';
import { queryHash } from '../../src/cache/store.js';

describe('queryHash', () => {
  it('produces a 16-character hex hash', () => {
    const hash = queryHash('savant', { player: 'Judge', season: 2025 });
    expect(hash).toMatch(/^[a-f0-9]{16}$/);
  });

  it('is deterministic for the same inputs', () => {
    const params = { player: 'Judge', season: 2025 };
    const a = queryHash('savant', params);
    const b = queryHash('savant', params);
    expect(a).toBe(b);
  });

  it('produces different hashes for different sources', () => {
    const params = { player: 'Judge', season: 2025 };
    const a = queryHash('savant', params);
    const b = queryHash('fangraphs', params);
    expect(a).not.toBe(b);
  });

  it('produces different hashes for different params', () => {
    const a = queryHash('savant', { player: 'Judge', season: 2025 });
    const b = queryHash('savant', { player: 'Ohtani', season: 2025 });
    expect(a).not.toBe(b);
  });

  it('normalizes key order (sorted keys)', () => {
    const a = queryHash('savant', { season: 2025, player: 'Judge' });
    const b = queryHash('savant', { player: 'Judge', season: 2025 });
    expect(a).toBe(b);
  });
});
