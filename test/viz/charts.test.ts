import { describe, it, expect } from 'vitest';
import { toMovementValues } from '../../src/viz/charts/movement-values.js';
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
  theme: 'light',
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
      title: { text: string };
      width: number;
      height: number;
      layer: Array<{ mark: { type: string }; encoding?: { color?: { scale?: { domain: string[]; range: string[] } }; shape?: unknown } }>;
      config: unknown;
    };
    expect(spec.title.text).toBe('Test Chart');
    expect(Array.isArray(spec.layer)).toBe(true);
    // Two zero lines, the point cloud, then ring + marker + label on top.
    expect(spec.layer.length).toBe(6);
    expect(spec.layer.at(-1)?.mark.type).toBe('text');
    expect(spec.config).toBeDefined();
    // Both axes are inches, so the plot is square inside the requested canvas.
    expect(spec.width).toBe(480);
    expect(spec.height).toBe(480);
    // Color follows the pitch: FF is red and SL is blue on every chart.
    const points = spec.layer[2]!;
    expect(points.encoding?.color?.scale?.domain).toEqual(['FF', 'SL']);
    expect(points.encoding?.color?.scale?.range).toEqual(['#e34948', '#2a78d6']);
    expect(points.encoding?.shape).toBeUndefined();
  });

  it('adds shape as a redundant channel for --colorblind, dark, and print', () => {
    const rows = {
      'pitcher-raw-pitches': [
        { pitch_type: 'FF', pfx_x: 0.8, pfx_z: 1.2, release_speed: 95 },
        { pitch_type: 'SL', pfx_x: -0.5, pfx_z: 0.4, release_speed: 87 },
      ],
    };
    type Spec = { layer: Array<{ encoding?: { shape?: { scale?: { range: string[] } }; color?: { scale?: { range: string[] } } } }> };
    const pointsOf = (o: Partial<ResolvedVizOptions>) =>
      (movementBuilder.buildSpec(rows, { ...baseOptions, ...o }) as Spec).layer[2]!.encoding!;
    expect(pointsOf({ colorblind: true }).shape?.scale?.range).toEqual(['circle', 'triangle-up']);
    expect(pointsOf({ theme: 'dark' }).shape).toBeDefined();
    const print = pointsOf({ theme: 'print' });
    expect(print.shape).toBeDefined();
    for (const hex of print.color!.scale!.range) expect(hex).toMatch(/^#([0-9a-f]{2})\1\1$/i);
  });
});

describe('movementBinnedBuilder', () => {
  it('declares the pitcher-raw-pitches requirement', () => {
    expect(movementBinnedBuilder.id).toBe('movement-binned');
    expect(movementBinnedBuilder.dataRequirements).toHaveLength(1);
    expect(movementBinnedBuilder.dataRequirements[0]?.queryTemplate).toBe('pitcher-raw-pitches');
  });

  it('bins both axes in square 2.5-in cells and sizes one circle per (bin, pitch type) by count', () => {
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
      width: number;
      height: number;
      layer: Array<{
        mark: { type: string } | string;
        encoding?: {
          x?: { bin?: { step?: number } };
          y?: { bin?: { step?: number } };
          size?: { aggregate?: string };
          color?: { field?: string };
        };
      }>;
    };

    // Layers 0–1 are the zero lines; layer 2 is the bubble layer.
    const bubbles = spec.layer[2]!;
    const mark = typeof bubbles.mark === 'string' ? bubbles.mark : bubbles.mark.type;
    expect(mark).toBe('point');
    // Square bins: the audit found 5×2-in rects made density read
    // differently horizontally vs vertically.
    expect(bubbles.encoding?.x?.bin?.step).toBe(2.5);
    expect(bubbles.encoding?.y?.bin?.step).toBe(2.5);
    expect(bubbles.encoding?.size?.aggregate).toBe('count');
    expect(bubbles.encoding?.color?.field).toBe('pitch_type');
    expect(spec.width).toBe(spec.height);
  });

  it('keeps the labeled per-pitch-type mean marker on top', () => {
    const rows = {
      'pitcher-raw-pitches': [
        { pitch_type: 'FF', pfx_x: 0.8, pfx_z: 1.2, release_speed: 95 },
      ],
    };
    const spec = movementBinnedBuilder.buildSpec(rows, {
      ...baseOptions,
      type: 'movement-binned',
    }) as {
      layer: Array<{ mark: { type?: string } | string; data?: { values: Array<{ pitch_type: string; hBreak: number }> } }>;
    };
    const label = spec.layer.at(-1)!;
    expect(typeof label.mark === 'object' && label.mark.type).toBe('text');
    expect(label.data?.values[0]?.pitch_type).toBe('FF');
    expect(label.data?.values[0]?.hBreak).toBeCloseTo(-9.6);
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

  it('maps Savant events to display labels and buckets every non-hit as Out', () => {
    const rows = {
      'hitter-raw-bip': [
        { hc_x: 125.42, hc_y: 104, launch_speed: 100, launch_angle: 25, events: 'home_run' },
        { hc_x: 120, hc_y: 150, launch_speed: 90, launch_angle: 10, events: 'grounded_into_double_play' },
        { hc_x: 130, hc_y: 160, launch_speed: 80, launch_angle: 30, events: 'sac_fly' },
        { hc_x: 110, hc_y: 140, launch_speed: 95, launch_angle: 12, events: 'single' },
      ],
    };
    type Spec = {
      layer: Array<{
        data?: { values: Array<{ result: string }> };
        encoding?: { color?: { scale?: { domain: string[]; range: string[] } }; shape?: { scale?: { range: string[] } } };
      }>;
    };
    const spec = sprayBuilder.buildSpec(rows, { ...baseOptions, type: 'spray' }) as Spec;
    const points = spec.layer[0]!;
    const results = points.data!.values.map((v) => v.result);
    expect(new Set(results)).toEqual(new Set(['Home run', 'Out', 'Single']));
    // Outs draw first so a hit never hides under one.
    expect(results.slice(0, 2)).toEqual(['Out', 'Out']);
    // Legend lists only results present, in hit-value order.
    expect(points.encoding?.color?.scale?.domain).toEqual(['Single', 'Home run', 'Out']);
    expect(points.encoding?.color?.scale?.range).toEqual(['#2a78d6', '#e34948', '#b5b3ad']);
    expect(points.encoding?.shape).toBeUndefined();
  });

  it('adds a result shape under --colorblind and in the print theme, keeping the palette', () => {
    const rows = {
      'hitter-raw-bip': [
        { hc_x: 125.42, hc_y: 104, launch_speed: 100, launch_angle: 25, events: 'home_run' },
        { hc_x: 110, hc_y: 140, launch_speed: 95, launch_angle: 12, events: 'double' },
      ],
    };
    type Spec = { layer: Array<{ encoding?: { color?: { scale?: { range: string[] } }; shape?: { scale?: { domain: string[]; range: string[] } } } }> };
    const enc = (o: Partial<ResolvedVizOptions>) =>
      (sprayBuilder.buildSpec(rows, { ...baseOptions, type: 'spray', ...o }) as Spec).layer[0]!.encoding!;
    const cb = enc({ colorblind: true });
    expect(cb.shape?.scale?.domain).toEqual(['Double', 'Home run']);
    expect(cb.shape?.scale?.range).toEqual(['square', 'diamond']);
    expect(cb.color?.scale?.range).toEqual(enc({}).color?.scale?.range);
    const print = enc({ theme: 'print' });
    expect(print.shape).toBeDefined();
    for (const hex of print.color!.scale!.range) expect(hex).toMatch(/^#([0-9a-f]{2})\1\1$/i);
  });

  it('draws the field at equal feet per pixel with the foul lines ending on the fence arc', () => {
    const rows = { 'hitter-raw-bip': [{ hc_x: 125.42, hc_y: 104, launch_speed: 100, launch_angle: 25, events: 'single' }] };
    type Spec = {
      width: number;
      height: number;
      layer: Array<{ data?: { values: Array<{ x: number; y: number; line?: string }> }; encoding?: { x?: { scale?: { domain: number[] } }; y?: { scale?: { domain: number[] } } } }>;
    };
    const spec = sprayBuilder.buildSpec(rows, { ...baseOptions, type: 'spray' }) as Spec;
    const xd = spec.layer[0]!.encoding!.x!.scale!.domain;
    const yd = spec.layer[0]!.encoding!.y!.scale!.domain;
    // Pixels are integers, so the two scales agree to rounding.
    expect(spec.width / (xd[1]! - xd[0]!)).toBeCloseTo(spec.height / (yd[1]! - yd[0]!), 2);
    const foul = spec.layer.find((l) => l.data?.values[0]?.line === 'L')!.data!.values;
    const tip = foul.find((p) => p.line === 'L' && p.x !== 0)!;
    expect(Math.hypot(tip.x, tip.y)).toBeCloseTo(400, 0);
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
      width: number;
      height: number;
      layer: Array<{ mark: { type: string }; encoding?: { text?: { field: string } } }>;
      data: { values: Array<{ label: string; sub: string }> };
    };
    // Cells, the xwOBA label, and the PA count beneath it.
    expect(spec.layer).toHaveLength(3);
    expect(spec.layer.map((l) => l.mark.type)).toEqual(['rect', 'text', 'text']);
    expect(spec.data.values[0]?.label).toBe('.250');
    expect(spec.data.values[0]?.sub).toBe('0 PA');
    // A strike zone is taller than wide (17 in × ~24 in), whatever the canvas.
    expect(spec.height).toBe(480);
    expect(spec.width).toBe(340);
  });

  it('uses one sequential hue in every mode (magnitude, not polarity)', () => {
    const rows = {
      'hitter-zone-grid': [
        { zone: 'z0', row: 0, col: 0, pitches: 1, pa: 1, xwoba: 0.3 },
      ],
    };
    type Spec = { layer: Array<{ encoding?: { color?: { scale?: { range?: string[]; scheme?: string } } } }> };
    const rangeOf = (o: Partial<ResolvedVizOptions>) =>
      (zoneBuilder.buildSpec(rows, { ...baseOptions, type: 'zone', ...o }) as Spec).layer[0]?.encoding?.color?.scale;
    expect(rangeOf({}).scheme).toBeUndefined();
    expect(rangeOf({}).range).toHaveLength(7);
    expect(rangeOf({ colorblind: true }).range).toEqual(rangeOf({}).range);
    for (const hex of rangeOf({ theme: 'print' }).range!) expect(hex).toMatch(/^#([0-9a-f]{2})\1\1$/i);
  });
});

/**
 * The rolling family stacks one panel per metric with `vconcat`. These
 * helpers read the panels back: the line layer is index 2 in every panel
 * (band, mean rule, line, points, latest label).
 */
type RollingPanel = {
  title: { text: string };
  layer: Array<{
    data?: { values: Array<Record<string, unknown>> };
    encoding?: { detail?: { field: string }; y?: { axis?: { labelExpr?: string } } };
  }>;
};
type RollingSpec = {
  title: { text: string; subtitle: string };
  vconcat: RollingPanel[];
  resolve?: { scale?: { y?: string; x?: string } };
};
function panelOf(spec: RollingSpec, metric: string): RollingPanel {
  const p = spec.vconcat.find((v) => v.title.text === metric);
  if (!p) throw new Error(`no panel for ${metric}`);
  return p;
}
function pointsOf(spec: RollingSpec, metric: string) {
  return panelOf(spec, metric).layer[2]!.data!.values as Array<{ window_end: string; value: number; segment: number }>;
}

describe('rollingBuilder', () => {
  it('pivots wide rows into one panel per metric', () => {
    const rows = {
      'trend-rolling-average': [
        { 'Window End': '2025-05-01', AVG: '0.300', SLG: '0.520' },
        { 'Window End': '2025-05-08', AVG: '0.312', SLG: '0.540' },
      ],
    };
    const spec = rollingBuilder.buildSpec(rows, { ...baseOptions, type: 'rolling' }) as RollingSpec;
    expect(spec.vconcat.map((p) => p.title.text)).toEqual(['AVG', 'SLG']);
    const avg = pointsOf(spec, 'AVG');
    expect(avg).toHaveLength(2);
    expect(avg[0]?.value).toBeCloseTo(0.3);
  });

  it('parses numerics out of strings with units (mph, %) and formats each panel by its unit', () => {
    const rows = {
      'trend-rolling-average': [
        { 'Window End': '2025-05-01', Velo: '95.2 mph', Whiff: '35.7%', AVG: '0.300' },
      ],
    };
    const spec = rollingBuilder.buildSpec(rows, { ...baseOptions, type: 'rolling' }) as RollingSpec;
    expect(pointsOf(spec, 'Velo')[0]?.value).toBeCloseTo(95.2);
    expect(pointsOf(spec, 'Whiff')[0]?.value).toBeCloseTo(35.7);
    const labelExpr = (m: string) => panelOf(spec, m).layer[2]!.encoding!.y!.axis!.labelExpr;
    expect(labelExpr('AVG')).toContain("'.3f'"); // .312, not 0.312
    expect(labelExpr('Whiff')).toContain("'%'");
    expect(labelExpr('Velo')).toContain("'.0f'");
    // Headline value per panel, formatted the same way.
    const latest = (m: string) => (panelOf(spec, m).layer.at(-1)!.data!.values[0] as { label: string }).label;
    expect(latest('AVG')).toBe('.300');
    expect(latest('Whiff')).toBe('35.7%');
    expect(latest('Velo')).toBe('95.2');
  });

  it('shares the time axis and keeps every value axis independent', () => {
    const rows = {
      'trend-rolling-average': [
        { 'Window End': '2025-05-01', AVG: '0.300', 'Avg EV': '90.5 mph' },
        { 'Window End': '2025-05-08', AVG: '0.312', 'Avg EV': '91.2 mph' },
      ],
    };
    const spec = rollingBuilder.buildSpec(rows, { ...baseOptions, type: 'rolling' }) as RollingSpec;
    expect(spec.vconcat).toHaveLength(2);
    expect(spec.resolve?.scale?.y).toBe('independent');
    expect(spec.resolve?.scale?.x).toBe('shared');
  });

  it('gives an mph panel a domain of at least ±2 around its mean', () => {
    const rows = {
      'trend-rolling-average': [
        { 'Window End': '2025-05-01', 'Avg EV': '90.5 mph', AVG: '0.300' },
        { 'Window End': '2025-05-08', 'Avg EV': '90.9 mph', AVG: '0.312' },
      ],
    };
    const spec = rollingBuilder.buildSpec(rows, { ...baseOptions, type: 'rolling' }) as RollingSpec;
    const band = panelOf(spec, 'Avg EV').layer[0]!.data!.values[0] as { lo: number; hi: number };
    expect(band.lo).toBeCloseTo(88.7);
    expect(band.hi).toBeCloseTo(92.7);
    expect(panelOf(spec, 'AVG').layer[0]!.data!.values).toHaveLength(0);
  });

  it('names the window size in the subtitle', () => {
    const rows = {
      'trend-rolling-average': [
        { 'Window End': '2025-05-01', Games: 15, AVG: '0.300' },
        { 'Window End': '2025-05-08', Games: 15, AVG: '0.312' },
      ],
    };
    const spec = rollingBuilder.buildSpec(rows, { ...baseOptions, type: 'rolling' }) as RollingSpec;
    expect(spec.title.subtitle).toContain('15-game windows');
    const forced = rollingBuilder.buildSpec(rows, { ...baseOptions, type: 'rolling', window: 5 }) as RollingSpec;
    expect(forced.title.subtitle).toContain('5-game windows');
  });

  it('breaks the line across a gap longer than 21 days instead of interpolating', () => {
    // Judge 2026: windows every ~5 days through May 26, then nothing until
    // Sep 8. The old chart drew one straight line across the IL stint.
    const rows = {
      'trend-rolling-average': [
        { 'Window End': '2026-05-15', AVG: '0.234' },
        { 'Window End': '2026-05-20', AVG: '0.188' },
        { 'Window End': '2026-05-26', AVG: '0.197' },
        { 'Window End': '2026-09-08', AVG: '0.154' },
        { 'Window End': '2026-09-14', AVG: '0.177' },
      ],
    };
    const spec = rollingBuilder.buildSpec(rows, { ...baseOptions, type: 'rolling' }) as RollingSpec;
    const pts = pointsOf(spec, 'AVG');
    const segmentOf = (d: string) => pts.find((r) => r.window_end === d)?.segment;
    expect(segmentOf('2026-05-15')).toBe(0);
    expect(segmentOf('2026-05-26')).toBe(0);
    expect(segmentOf('2026-09-08')).toBe(1);
    expect(segmentOf('2026-09-14')).toBe(1);
    expect(panelOf(spec, 'AVG').layer[2]?.encoding?.detail?.field).toBe('segment');
  });

  it('keeps one segment when windows are evenly spaced', () => {
    const rows = {
      'trend-rolling-average': [
        { 'Window End': '2026-05-01', AVG: '0.300' },
        { 'Window End': '2026-05-08', AVG: '0.312' },
        { 'Window End': '2026-05-15', AVG: '0.320' },
      ],
    };
    const spec = rollingBuilder.buildSpec(rows, { ...baseOptions, type: 'rolling' }) as RollingSpec;
    expect(new Set(pointsOf(spec, 'AVG').map((r) => r.segment))).toEqual(new Set([0]));
  });

  it('excludes Games from metric auto-detection', () => {
    const rows = {
      'trend-rolling-average': [
        { 'Window End': '2025-05-01', Games: 15, AVG: '0.300' },
        { 'Window End': '2025-05-08', Games: 15, AVG: '0.312' },
      ],
    };
    const spec = rollingBuilder.buildSpec(rows, { ...baseOptions, type: 'rolling' }) as RollingSpec;
    expect(spec.vconcat.map((p) => p.title.text)).toEqual(['AVG']);
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
    }) as RollingSpec;
    expect(spec.vconcat.map((p) => p.title.text)).toEqual(['Avg Velo', 'Whiff %']);
    const velo = pointsOf(spec, 'Avg Velo');
    expect(velo).toHaveLength(2);
    expect(velo[0]?.value).toBeCloseTo(95.2);
  });

  it('excludes Starts from metric auto-detection and names start windows in the subtitle', () => {
    const rows = {
      'pitcher-rolling-trend': [
        { 'Window End': '2025-05-01', Starts: 5, 'Avg Velo': '95.2 mph' },
        { 'Window End': '2025-05-08', Starts: 5, 'Avg Velo': '95.5 mph' },
      ],
    };
    const spec = pitcherRollingBuilder.buildSpec(rows, {
      ...baseOptions,
      type: 'pitcher-rolling',
    }) as RollingSpec;
    expect(spec.vconcat.map((p) => p.title.text)).toEqual(['Avg Velo']);
    expect(spec.title.subtitle).toContain('5-start windows');
  });

  it('stacks one panel per metric with independent y scales', () => {
    const rows = {
      'pitcher-rolling-trend': [
        { 'Window End': '2025-05-01', 'Avg Velo': '95.2 mph', 'CSW %': '30.5%' },
        { 'Window End': '2025-05-08', 'Avg Velo': '95.5 mph', 'CSW %': '32.1%' },
      ],
    };
    const spec = pitcherRollingBuilder.buildSpec(rows, {
      ...baseOptions,
      type: 'pitcher-rolling',
    }) as RollingSpec;
    expect(spec.vconcat).toHaveLength(2);
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
  it('listChartTypes returns all eight chart types', () => {
    const types = listChartTypes();
    expect(types).toEqual(
      expect.arrayContaining([
        'movement',
        'movement-binned',
        'spray',
        'zone',
        // 2026-09 redesign — the ranked-bar sibling of zone.
        'zone-ranked',
        'rolling',
        'pitcher-rolling',
        // P5.1 — the chart `--players` drives.
        'comparison',
      ]),
    );
    expect(types).toHaveLength(8);
  });

  it('getChartBuilder returns the correct builder for each type', () => {
    expect(getChartBuilder('movement').id).toBe('movement');
    expect(getChartBuilder('movement-binned').id).toBe('movement-binned');
    expect(getChartBuilder('spray').id).toBe('spray');
    expect(getChartBuilder('zone').id).toBe('zone');
    expect(getChartBuilder('zone-ranked').id).toBe('zone-ranked');
    expect(getChartBuilder('hitting-zones-ranked').id).toBe('zone-ranked');
    expect(getChartBuilder('rolling').id).toBe('rolling');
    expect(getChartBuilder('pitcher-rolling').id).toBe('pitcher-rolling');
  });

  it('getChartBuilder throws for unknown types', () => {
    // @ts-expect-error — deliberately invalid type
    expect(() => getChartBuilder('nonexistent')).toThrow('Unknown chart type');
  });
});

describe('toMovementValues', () => {
  it('drops pitches with null movement instead of plotting them at the origin (P1.11)', () => {
    // With nullable pfx (P1.11), `null * 12` would coerce to 0 and pin
    // dropped-tracking pitches to (0, 0) on the movement charts.
    const values = toMovementValues([
      { pitch_type: 'FF', pfx_x: 0.5, pfx_z: 1.2, release_speed: 95.4 },
      { pitch_type: 'SL', pfx_x: null, pfx_z: 0.3, release_speed: 87.0 },
      { pitch_type: 'CH', pfx_x: -1.1, pfx_z: null, release_speed: 88.2 },
    ]);
    expect(values).toHaveLength(1);
    expect(values[0].pitch_type).toBe('FF');
    expect(values[0].hBreak).toBeCloseTo(-6); // feet → inches, flipped for catcher POV
    expect(values[0].vBreak).toBeCloseTo(14.4);
    expect(values[0].velo).toBe(95.4);
  });
});
