import { describe, it, expect } from 'vitest';
import { movementBuilder } from '../../src/viz/charts/movement.js';
import { movementBinnedBuilder } from '../../src/viz/charts/movement-binned.js';
import { sprayBuilder } from '../../src/viz/charts/spray.js';
import { zoneBuilder } from '../../src/viz/charts/zone.js';
import { rollingBuilder } from '../../src/viz/charts/rolling.js';
import { pitcherRollingBuilder } from '../../src/viz/charts/pitcher-rolling.js';
import { getChartBuilder, listChartTypes } from '../../src/viz/charts/index.js';
import type { ResolvedVizOptions } from '../../src/viz/types.js';

const baseOptions: ResolvedVizOptions = {
  type: 'movement',
  player: 'Test Pitcher',
  season: 2025,
  audience: 'analyst',
  format: 'svg',
  width: 640,
  height: 480,
  colorblind: false,
  title: 'Test Chart',
};

describe('movementBuilder', () => {
  it('declares the pitcher-raw-pitches requirement', () => {
    expect(movementBuilder.id).toBe('movement');
    expect(movementBuilder.dataRequirements).toHaveLength(1);
    expect(movementBuilder.dataRequirements[0]?.queryTemplate).toBe('pitcher-raw-pitches');
  });

  it('produces a Vega-Lite spec with layered point + centroid encoding', () => {
    const rows = {
      'pitcher-raw-pitches': [
        { pitch_type: 'FF', pfx_x: 0.8, pfx_z: 1.2, release_speed: 95 },
        { pitch_type: 'SL', pfx_x: -0.5, pfx_z: 0.4, release_speed: 87 },
      ],
    };
    const spec = movementBuilder.buildSpec(rows, baseOptions) as {
      title: string;
      layer: unknown[];
      config: unknown;
    };
    expect(spec.title).toBe('Test Chart');
    expect(Array.isArray(spec.layer)).toBe(true);
    expect(spec.layer.length).toBeGreaterThanOrEqual(3);
    expect(spec.config).toBeDefined();
  });
});

describe('movementBinnedBuilder', () => {
  it('declares the pitcher-raw-pitches requirement', () => {
    expect(movementBinnedBuilder.id).toBe('movement-binned');
    expect(movementBinnedBuilder.dataRequirements).toHaveLength(1);
    expect(movementBinnedBuilder.dataRequirements[0]?.queryTemplate).toBe('pitcher-raw-pitches');
  });

  it('uses a binned rect density layer aggregated by count (not per-pitch points)', () => {
    const rows = {
      'pitcher-raw-pitches': [
        { pitch_type: 'FF', pfx_x: 0.8, pfx_z: 1.2, release_speed: 95 },
        { pitch_type: 'SL', pfx_x: -0.5, pfx_z: 0.4, release_speed: 87 },
        { pitch_type: 'FF', pfx_x: 0.82, pfx_z: 1.18, release_speed: 95.2 },
      ],
    };
    const spec = movementBinnedBuilder.buildSpec(rows, {
      ...baseOptions,
      type: 'movement-binned',
    }) as {
      layer: Array<{
        mark: { type: string } | string;
        encoding?: {
          x?: { bin?: { maxbins?: number } };
          y?: { bin?: { maxbins?: number } };
          color?: { aggregate?: string };
        };
      }>;
    };

    // Layer 0 is the binned density; layer 1 is the mean-cross overlay.
    // The two axis `rule` layers from the unbinned chart are deliberately
    // omitted here — see the comment in movement-binned.ts for why.
    const densityLayer = spec.layer[0]!;
    const mark = typeof densityLayer.mark === 'string' ? densityLayer.mark : densityLayer.mark.type;
    expect(mark).toBe('rect');
    expect(densityLayer.encoding?.x?.bin?.maxbins).toBe(20);
    expect(densityLayer.encoding?.y?.bin?.maxbins).toBe(20);
    expect(densityLayer.encoding?.color?.aggregate).toBe('count');
  });

  it('keeps the per-pitch-type mean cross overlay', () => {
    const rows = {
      'pitcher-raw-pitches': [
        { pitch_type: 'FF', pfx_x: 0.8, pfx_z: 1.2, release_speed: 95 },
      ],
    };
    const spec = movementBinnedBuilder.buildSpec(rows, {
      ...baseOptions,
      type: 'movement-binned',
    }) as {
      layer: Array<{ mark: { type?: string; shape?: string } | string }>;
    };
    // Mean-cross is now layer index 1 (density is 0).
    const crossLayer = spec.layer[1];
    const crossMark = crossLayer?.mark;
    if (typeof crossMark === 'object') {
      expect(crossMark.type).toBe('point');
      expect(crossMark.shape).toBe('cross');
    } else {
      throw new Error('expected cross layer to have an object mark');
    }
  });
});

describe('sprayBuilder', () => {
  it('converts hc_x/hc_y via the standard Statcast transform', () => {
    const rows = {
      'hitter-raw-bip': [
        { hc_x: 125.42, hc_y: 104, launch_speed: 100, launch_angle: 25, events: 'home_run' },
      ],
    };
    const spec = sprayBuilder.buildSpec(rows, { ...baseOptions, type: 'spray' }) as {
      layer: Array<{ data?: { values: unknown[] } }>;
    };
    // Batted-ball points are the first layer (drives scale/axis merging)
    const pointsLayer = spec.layer[0];
    expect(pointsLayer?.data?.values).toHaveLength(1);
    const pt = (pointsLayer!.data!.values as Array<{ x: number; y: number }>)[0]!;
    // hc_x = 125.42 → x ≈ 0
    expect(Math.abs(pt.x)).toBeLessThan(0.1);
    // hc_y = 104 → y = (204 - 104) * 2.5 = 250
    expect(pt.y).toBeCloseTo(250, 1);
  });
});

describe('zoneBuilder', () => {
  it('produces a layered rect + text spec and declares hitter-zone-grid', () => {
    expect(zoneBuilder.dataRequirements[0]?.queryTemplate).toBe('hitter-zone-grid');
    const rows = {
      'hitter-zone-grid': Array.from({ length: 9 }, (_, i) => ({
        zone: `z${i}`,
        row: Math.floor(i / 3),
        col: i % 3,
        pitches: 10 + i,
        xwoba: 0.25 + i * 0.02,
      })),
    };
    const spec = zoneBuilder.buildSpec(rows, { ...baseOptions, type: 'zone' }) as {
      layer: unknown[];
    };
    expect(spec.layer).toHaveLength(2);
  });

  it('uses viridis scheme when colorblind is set', () => {
    const rows = {
      'hitter-zone-grid': [
        { zone: 'z0', row: 0, col: 0, pitches: 1, xwoba: 0.3 },
      ],
    };
    const spec = zoneBuilder.buildSpec(rows, {
      ...baseOptions,
      type: 'zone',
      colorblind: true,
    }) as {
      layer: Array<{ encoding?: { color?: { scale?: { scheme?: string } } } }>;
    };
    const rectLayer = spec.layer[0];
    expect(rectLayer?.encoding?.color?.scale?.scheme).toBe('viridis');
  });
});

describe('rollingBuilder', () => {
  it('pivots wide rows to tidy metric/value pairs', () => {
    const rows = {
      'trend-rolling-average': [
        { 'Window End': '2025-05-01', AVG: '0.300', SLG: '0.520' },
        { 'Window End': '2025-05-08', AVG: '0.312', SLG: '0.540' },
      ],
    };
    const spec = rollingBuilder.buildSpec(rows, { ...baseOptions, type: 'rolling' }) as {
      data: { values: Array<{ window_end: string; metric: string; value: number }> };
    };
    const tidy = spec.data.values;
    expect(tidy).toHaveLength(4); // 2 rows × 2 metrics
    const avg = tidy.filter((r) => r.metric === 'AVG');
    expect(avg).toHaveLength(2);
    expect(avg[0]?.value).toBeCloseTo(0.3);
  });

  it('parses numerics out of strings with units (mph, %)', () => {
    const rows = {
      'trend-rolling-average': [
        { 'Window End': '2025-05-01', Velo: '95.2 mph', Whiff: '35.7%' },
      ],
    };
    const spec = rollingBuilder.buildSpec(rows, { ...baseOptions, type: 'rolling' }) as {
      data: { values: Array<{ metric: string; value: number }> };
    };
    const velo = spec.data.values.find((r) => r.metric === 'Velo');
    expect(velo?.value).toBeCloseTo(95.2);
    const whiff = spec.data.values.find((r) => r.metric === 'Whiff');
    expect(whiff?.value).toBeCloseTo(35.7);
  });

  it('produces a faceted spec with independent y scales per metric', () => {
    const rows = {
      'trend-rolling-average': [
        { 'Window End': '2025-05-01', AVG: '0.300', 'Avg EV': '90.5 mph' },
        { 'Window End': '2025-05-08', AVG: '0.312', 'Avg EV': '91.2 mph' },
      ],
    };
    const spec = rollingBuilder.buildSpec(rows, { ...baseOptions, type: 'rolling' }) as {
      facet?: { row?: { field: string } };
      resolve?: { scale?: { y?: string } };
    };
    expect(spec.facet?.row?.field).toBe('metric');
    expect(spec.resolve?.scale?.y).toBe('independent');
  });

  it('excludes Games from metric auto-detection', () => {
    const rows = {
      'trend-rolling-average': [
        { 'Window End': '2025-05-01', Games: 15, AVG: '0.300' },
        { 'Window End': '2025-05-08', Games: 15, AVG: '0.312' },
      ],
    };
    const spec = rollingBuilder.buildSpec(rows, { ...baseOptions, type: 'rolling' }) as {
      data: { values: Array<{ metric: string }> };
    };
    const metrics = new Set(spec.data.values.map((r) => r.metric));
    expect(metrics.has('AVG')).toBe(true);
    expect(metrics.has('Games')).toBe(false);
  });

  it('emits a graceful message spec when tidy dataset is empty', () => {
    const rows = {
      'trend-rolling-average': [
        { Window: 'Insufficient data', 'Window End': '', Games: 3, AVG: '—' },
      ],
    };
    const spec = rollingBuilder.buildSpec(rows, { ...baseOptions, type: 'rolling' }) as {
      mark?: { type: string };
      data: { values: Array<{ msg?: string }> };
    };
    expect(spec.mark?.type).toBe('text');
    expect(spec.data.values[0]?.msg).toMatch(/Insufficient data/);
  });
});

describe('pitcherRollingBuilder', () => {
  it('declares the pitcher-rolling-trend requirement', () => {
    expect(pitcherRollingBuilder.id).toBe('pitcher-rolling');
    expect(pitcherRollingBuilder.dataRequirements).toHaveLength(1);
    expect(pitcherRollingBuilder.dataRequirements[0]?.queryTemplate).toBe('pitcher-rolling-trend');
  });

  it('pivots pitcher wide rows to tidy metric/value pairs', () => {
    const rows = {
      'pitcher-rolling-trend': [
        { 'Window End': '2025-05-01', 'Avg Velo': '95.2 mph', 'Whiff %': '30.5%' },
        { 'Window End': '2025-05-08', 'Avg Velo': '95.5 mph', 'Whiff %': '32.1%' },
      ],
    };
    const spec = pitcherRollingBuilder.buildSpec(rows, {
      ...baseOptions,
      type: 'pitcher-rolling',
    }) as {
      data: { values: Array<{ window_end: string; metric: string; value: number }> };
    };
    const tidy = spec.data.values;
    expect(tidy).toHaveLength(4); // 2 rows × 2 metrics
    const velo = tidy.filter((r) => r.metric === 'Avg Velo');
    expect(velo).toHaveLength(2);
    expect(velo[0]?.value).toBeCloseTo(95.2);
  });

  it('excludes Starts from metric auto-detection', () => {
    const rows = {
      'pitcher-rolling-trend': [
        { 'Window End': '2025-05-01', Starts: 5, 'Avg Velo': '95.2 mph' },
        { 'Window End': '2025-05-08', Starts: 5, 'Avg Velo': '95.5 mph' },
      ],
    };
    const spec = pitcherRollingBuilder.buildSpec(rows, {
      ...baseOptions,
      type: 'pitcher-rolling',
    }) as {
      data: { values: Array<{ metric: string }> };
    };
    const metrics = new Set(spec.data.values.map((r) => r.metric));
    expect(metrics.has('Avg Velo')).toBe(true);
    expect(metrics.has('Starts')).toBe(false);
  });

  it('produces a faceted spec with independent y scales per metric', () => {
    const rows = {
      'pitcher-rolling-trend': [
        { 'Window End': '2025-05-01', 'Avg Velo': '95.2 mph', 'CSW %': '30.5%' },
        { 'Window End': '2025-05-08', 'Avg Velo': '95.5 mph', 'CSW %': '32.1%' },
      ],
    };
    const spec = pitcherRollingBuilder.buildSpec(rows, {
      ...baseOptions,
      type: 'pitcher-rolling',
    }) as {
      facet?: { row?: { field: string } };
      resolve?: { scale?: { y?: string } };
    };
    expect(spec.facet?.row?.field).toBe('metric');
    expect(spec.resolve?.scale?.y).toBe('independent');
  });

  it('emits a graceful message spec referencing starts when tidy dataset is empty', () => {
    const rows = {
      'pitcher-rolling-trend': [
        { Window: 'Insufficient data', 'Window End': '', Starts: 3, 'Avg Velo': '—' },
      ],
    };
    const spec = pitcherRollingBuilder.buildSpec(rows, {
      ...baseOptions,
      type: 'pitcher-rolling',
    }) as {
      mark?: { type: string };
      data: { values: Array<{ msg?: string }> };
    };
    expect(spec.mark?.type).toBe('text');
    expect(spec.data.values[0]?.msg).toMatch(/5\+ starts/);
  });
});

describe('chart registry', () => {
  it('listChartTypes returns all six chart types', () => {
    const types = listChartTypes();
    expect(types).toEqual(
      expect.arrayContaining([
        'movement',
        'movement-binned',
        'spray',
        'zone',
        'rolling',
        'pitcher-rolling',
      ]),
    );
    expect(types).toHaveLength(6);
  });

  it('getChartBuilder returns the correct builder for each type', () => {
    expect(getChartBuilder('movement').id).toBe('movement');
    expect(getChartBuilder('movement-binned').id).toBe('movement-binned');
    expect(getChartBuilder('spray').id).toBe('spray');
    expect(getChartBuilder('zone').id).toBe('zone');
    expect(getChartBuilder('rolling').id).toBe('rolling');
    expect(getChartBuilder('pitcher-rolling').id).toBe('pitcher-rolling');
  });

  it('getChartBuilder throws for unknown types', () => {
    // @ts-expect-error — deliberately invalid type
    expect(() => getChartBuilder('nonexistent')).toThrow('Unknown chart type');
  });
});
