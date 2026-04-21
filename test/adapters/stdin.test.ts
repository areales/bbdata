import { describe, it, expect } from 'vitest';
import { StdinAdapter } from '../../src/adapters/stdin.js';

describe('StdinAdapter', () => {
  it('treats loaded empty payloads as a supported query path', async () => {
    const adapter = new StdinAdapter();
    adapter.load('[]');

    expect(adapter.supports({ season: 2026, stat_type: 'pitching' })).toBe(true);

    const result = await adapter.fetch({ season: 2026, stat_type: 'pitching' });
    expect(result.meta.rowCount).toBe(0);
    expect(result.data).toEqual([]);
  });

  it('throws a parse error for invalid stdin JSON', () => {
    const adapter = new StdinAdapter();
    expect(() => adapter.load('{invalid-json}')).toThrow('Failed to parse stdin data');
  });
});
