import { describe, it, expect } from 'vitest';
import type { PlayerStats } from '../../src/adapters/types.js';

import '../../src/templates/queries/index.js';
import { getTemplate } from '../../src/templates/queries/registry.js';

describe('pitcher-season-profile template', () => {
  const template = getTemplate('pitcher-season-profile')!;

  it('is registered and prefers FanGraphs', () => {
    expect(template).toBeDefined();
    expect(template.id).toBe('pitcher-season-profile');
    expect(template.preferredSources).toContain('fangraphs');
  });

  it('buildQuery produces a pitching stat_type query', () => {
    const q = template.buildQuery({ player: 'Corbin Burnes', season: 2024 });
    expect(q.stat_type).toBe('pitching');
    expect(q.player_name).toBe('Corbin Burnes');
    expect(q.season).toBe(2024);
  });

  it('transforms a FanGraphs row into a Metric/Value table', () => {
    const input: PlayerStats[] = [
      {
        player_id: '669203',
        player_name: 'Corbin Burnes',
        team: 'BAL',
        season: 2024,
        stat_type: 'pitching',
        stats: {
          W: 15,
          L: 9,
          ERA: 2.92,
          IP: 194.1,
          GS: 32,
          FIP: 3.47,
          xFIP: 3.82,
          SIERA: 3.65,
          'K-BB%': 18.5,
          WAR: 4.2,
        },
      },
    ];
    const rows = template.transform(input, { player: 'Corbin Burnes' });

    const byMetric = new Map(rows.map((r) => [r.Metric, r.Value]));
    expect(byMetric.get('W-L')).toBe('15-9');
    expect(byMetric.get('ERA')).toBe('2.92');
    expect(byMetric.get('IP')).toBe('194.1');
    expect(byMetric.get('GS')).toBe('32');
    expect(byMetric.get('FIP')).toBe('3.47');
    expect(byMetric.get('xFIP')).toBe('3.82');
    expect(byMetric.get('SIERA')).toBe('3.65');
    expect(byMetric.get('K-BB%')).toBe('18.5%');
    expect(byMetric.get('WAR')).toBe('4.2');
  });

  it('renders em-dash for missing stats', () => {
    const input: PlayerStats[] = [
      {
        player_id: '1',
        player_name: 'Test',
        team: 'XXX',
        season: 2024,
        stat_type: 'pitching',
        stats: { ERA: 3.5 },
      },
    ];
    const rows = template.transform(input, { player: 'Test' });
    const byMetric = new Map(rows.map((r) => [r.Metric, r.Value]));
    expect(byMetric.get('ERA')).toBe('3.50');
    expect(byMetric.get('FIP')).toBe('—');
    expect(byMetric.get('WAR')).toBe('—');
  });

  it('returns empty array when adapter produced no rows', () => {
    expect(template.transform([], { player: 'nobody' })).toEqual([]);
  });
});

describe('hitter-season-profile template', () => {
  const template = getTemplate('hitter-season-profile')!;

  it('is registered and prefers FanGraphs', () => {
    expect(template).toBeDefined();
    expect(template.id).toBe('hitter-season-profile');
    expect(template.preferredSources).toContain('fangraphs');
  });

  it('buildQuery produces a batting stat_type query', () => {
    const q = template.buildQuery({ player: 'Aaron Judge', season: 2024 });
    expect(q.stat_type).toBe('batting');
  });

  it('transforms a FanGraphs row into a slash-line + advanced Metric/Value table', () => {
    const input: PlayerStats[] = [
      {
        player_id: '592450',
        player_name: 'Aaron Judge',
        team: 'NYY',
        season: 2024,
        stat_type: 'batting',
        stats: {
          AVG: 0.322,
          OBP: 0.458,
          SLG: 0.701,
          wOBA: 0.458,
          'wRC+': 218,
          ISO: 0.379,
          HR: 58,
          'BB%': 18.8,
          'K%': 25.4,
          WAR: 10.8,
        },
      },
    ];
    const rows = template.transform(input, { player: 'Aaron Judge' });
    const byMetric = new Map(rows.map((r) => [r.Metric, r.Value]));
    expect(byMetric.get('AVG')).toBe('0.322');
    expect(byMetric.get('OBP')).toBe('0.458');
    expect(byMetric.get('SLG')).toBe('0.701');
    expect(byMetric.get('wOBA')).toBe('0.458');
    expect(byMetric.get('wRC+')).toBe('218');
    expect(byMetric.get('ISO')).toBe('0.379');
    expect(byMetric.get('HR')).toBe('58');
    expect(byMetric.get('BB%')).toBe('18.8%');
    expect(byMetric.get('K%')).toBe('25.4%');
    expect(byMetric.get('WAR')).toBe('10.8');
  });

  it('returns empty array when adapter produced no rows', () => {
    expect(template.transform([], { player: 'nobody' })).toEqual([]);
  });
});
