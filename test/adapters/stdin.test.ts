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

  it('honors query.pitch_type on pitch-level records (G.7)', async () => {
    const adapter = new StdinAdapter();
    adapter.load(JSON.stringify([
      { pitcher_id: '1', pitch_type: 'FF', release_speed: 95 },
      { pitcher_id: '1', pitch_type: 'SL', release_speed: 87 },
      { pitcher_id: '1', pitch_type: 'CH', release_speed: 89 },
      { pitcher_id: '1', pitch_type: 'FF', release_speed: 96 },
    ]));

    const result = await adapter.fetch({
      season: 2025,
      stat_type: 'pitching',
      pitch_type: ['FF'],
    });

    expect(result.meta.rowCount).toBe(2);
    expect(result.data.every((r) => (r as { pitch_type: string }).pitch_type === 'FF')).toBe(true);
  });

  it('pitch_type filter is case-insensitive', async () => {
    const adapter = new StdinAdapter();
    adapter.load(JSON.stringify([
      { pitcher_id: '1', pitch_type: 'ff', release_speed: 95 },
      { pitcher_id: '1', pitch_type: 'SL', release_speed: 87 },
    ]));

    const result = await adapter.fetch({
      season: 2025,
      stat_type: 'pitching',
      pitch_type: ['FF'],
    });

    expect(result.meta.rowCount).toBe(1);
  });

  it('no pitch_type filter returns all records unchanged', async () => {
    const adapter = new StdinAdapter();
    adapter.load(JSON.stringify([
      { pitcher_id: '1', pitch_type: 'FF', release_speed: 95 },
      { pitcher_id: '1', pitch_type: 'SL', release_speed: 87 },
    ]));

    const result = await adapter.fetch({ season: 2025, stat_type: 'pitching' });
    expect(result.meta.rowCount).toBe(2);
  });

  it('pitch_type filter is a no-op on season-aggregate records (no pitch_type field)', async () => {
    const adapter = new StdinAdapter();
    adapter.load(JSON.stringify([
      { player_id: '1', player_name: 'A', team: 'NYY', season: 2025, stat_type: 'batting', stats: {} },
      { player_id: '2', player_name: 'B', team: 'LAD', season: 2025, stat_type: 'batting', stats: {} },
    ]));

    const result = await adapter.fetch({
      season: 2025,
      stat_type: 'batting',
      pitch_type: ['FF'],
    });

    expect(result.meta.rowCount).toBe(2);
  });
});
