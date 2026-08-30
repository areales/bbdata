import { describe, it, expect } from 'vitest';
import type { PlayerStats } from '../../src/adapters/types.js';

import '../../src/templates/queries/index.js';
import { getTemplate } from '../../src/templates/queries/registry.js';

const template = getTemplate('trend-year-over-year')!;

function seasonRow(season: number, stats: Record<string, unknown>): PlayerStats {
  return {
    player_id: '677594',
    player_name: 'Julio Rodriguez',
    team: 'SEA',
    season,
    stat_type: 'batting',
    stats: stats as PlayerStats['stats'],
  };
}

describe('trend-year-over-year template', () => {
  it('buildQuery derives a season range from --seasons (P1.9 regression)', () => {
    // The printed lesson example: --seasons 2024-2025 used to be ignored
    // entirely — the query defaulted to the current year and returned 0 rows.
    const q = template.buildQuery({ player: 'Corbin Burnes', seasons: '2024-2025' });
    expect(q.season).toBe(2025);
    expect(q.start_season).toBe(2024);
  });

  it('buildQuery treats a single year as that year vs the prior one', () => {
    const q = template.buildQuery({ player: 'X', seasons: '2025' });
    expect(q.season).toBe(2025);
    expect(q.start_season).toBe(2024);
  });

  it('buildQuery rejects malformed or reversed ranges', () => {
    expect(() => template.buildQuery({ player: 'X', seasons: 'banana' })).toThrow(/Invalid --seasons/);
    expect(() => template.buildQuery({ player: 'X', seasons: '2025-2024' })).toThrow(/earlier→later/);
  });

  it('compares the two most recent seasons and flags >10% changes', () => {
    const rows = [
      seasonRow(2025, { AVG: 0.259, HR: 31, 'wRC+': 140, 'K%': 0.201, WAR: 6.1 }),
      seasonRow(2024, { AVG: 0.231, HR: 22, 'wRC+': 108, 'K%': 0.219, WAR: 3.8 }),
    ];
    const out = template.transform(rows, { player: 'Julio Rodriguez', seasons: '2024-2025' });
    const byMetric = new Map(out.map((r) => [r.Metric, r]));

    const avg = byMetric.get('AVG')!;
    expect(avg.Prior).toBe('0.231');
    expect(avg.Current).toBe('0.259');
    expect(avg.Change).toBe('+0.028');
    expect(avg.Flag).toBe('⚠'); // 12% relative jump

    const hr = byMetric.get('HR')!;
    expect(hr.Prior).toBe('22');
    expect(hr.Current).toBe('31');
    expect(hr.Change).toBe('+9');
    expect(hr.Flag).toBe('⚠');

    const k = byMetric.get('K%')!;
    expect(k.Prior).toBe('21.9%');
    expect(k.Current).toBe('20.1%');
    expect(k.Change).toBe('-1.8%');
    expect(k.Flag).toBe(''); // 8% relative — under the flag threshold
  });

  it('does not collide wRC+ with wRC (P1.17 defect class)', () => {
    const rows = [
      seasonRow(2025, { wRC: 120.4, 'wRC+': 168 }),
      seasonRow(2024, { wRC: 95.1, 'wRC+': 132 }),
    ];
    const out = template.transform(rows, { player: 'Julio Rodriguez', seasons: '2024-2025' });
    const wrc = out.find((r) => r.Metric === 'wRC+')!;
    expect(wrc.Current).toBe('168');
    expect(wrc.Prior).toBe('132');
  });

  it('degrades to a Prior-less table on single-season data', () => {
    const rows = [seasonRow(2025, { AVG: 0.259 })];
    const out = template.transform(rows, { player: 'Julio Rodriguez', seasons: '2024-2025' });
    const avg = out.find((r) => r.Metric === 'AVG')!;
    expect(avg.Current).toBe('0.259');
    expect(avg.Prior).toBe('—');
    expect(avg.Change).toBe('—');
  });

  it('supports --stat pitching with a pitching metric set', () => {
    const q = template.buildQuery({ player: 'Corbin Burnes', seasons: '2024-2025', stat: 'pitching' });
    expect(q.stat_type).toBe('pitching');

    const rows = [
      { ...seasonRow(2025, { ERA: 2.1, 'K-BB%': 0.221, IP: 190.2, WAR: 6.4 }), stat_type: 'pitching' as const },
      { ...seasonRow(2024, { ERA: 2.92, 'K-BB%': 0.186, IP: 194.1, WAR: 4.2 }), stat_type: 'pitching' as const },
    ];
    const out = template.transform(rows, { player: 'Corbin Burnes', seasons: '2024-2025', stat: 'pitching' });
    const era = out.find((r) => r.Metric === 'ERA')!;
    expect(era.Prior).toBe('2.92');
    expect(era.Current).toBe('2.10');
    expect(era.Flag).toBe('⚠');
    const kbb = out.find((r) => r.Metric === 'K-BB%')!;
    expect(kbb.Current).toBe('22.1%');
  });

  it('rejects unknown --stat values', () => {
    expect(() => template.buildQuery({ player: 'X', seasons: '2024-2025', stat: 'fielding' }))
      .toThrow(/Expected "batting" \(default\) or "pitching"/);
  });

  it('turns an all-zero batting line into a pitcher hint instead of a table of zeros', () => {
    // FanGraphs qual=0 batting leaderboards include pitchers as 0-PA rows.
    const rows = [
      seasonRow(2025, { PA: 0, AVG: 0, OBP: 0 }),
      seasonRow(2024, { PA: 0, AVG: 0, OBP: 0 }),
    ];
    expect(() => template.transform(rows, { player: 'Corbin Burnes', seasons: '2024-2025' }))
      .toThrow(/--stat pitching/);
  });

  it('returns empty array when adapter produced no rows', () => {
    expect(template.transform([], { player: 'nobody', seasons: '2024-2025' })).toEqual([]);
  });
});
