import type { ResolvedVizOptions } from '../types.js';
import { AUDIENCE_DEFAULTS } from '../audience.js';
import { THEMES, pitchEncoding, textHalo, type PitchEncoding } from '../theme.js';

/**
 * Shared value builder for the movement chart family.
 *
 * Converts raw Savant pfx_* (feet) into the inches / catcher-POV shape
 * both movement charts plot. Pitches with missing movement tracking
 * (null pfx — see P1.11) are dropped so they don't plot at the origin.
 * Any change to the unit convention, coordinate flip, or value shape
 * belongs here so `movement` and `movement-binned` can't drift apart.
 */
// Type alias, not interface — the chart builders cast the untyped
// Record rows to this shape, and only object-literal aliases carry the
// implicit index signature that makes that cast legal.
export type MovementPitch = {
  pitch_type: string;
  pfx_x: number | null;
  pfx_z: number | null;
  release_speed: number | null;
};

export function toMovementValues(pitches: MovementPitch[]) {
  return pitches.flatMap((p) => {
    if (p.pfx_x == null || p.pfx_z == null) return [];
    return [{
      pitch_type: p.pitch_type,
      hBreak: -p.pfx_x * 12, // feet → inches, flipped for catcher POV
      vBreak: p.pfx_z * 12,
      velo: p.release_speed,
    }];
  });
}

/** Movement space is symmetric: ±25 in on both axes. */
export const MOVEMENT_DOMAIN: [number, number] = [-25, 25];

/**
 * Both axes are inches, so the plot must be square or a 10-in sweep reads
 * longer one way than the other. The requested canvas is the bounding box;
 * `viz()` reports the effective size in `meta`.
 */
export function movementSide(options: Pick<ResolvedVizOptions, 'width' | 'height'>): number {
  return Math.min(options.width, options.height);
}

/** Per-pitch-type mean location plus a display label, for the mean layers. */
export function pitchMeans(values: ReturnType<typeof toMovementValues>) {
  const acc = new Map<string, { n: number; h: number; v: number }>();
  for (const p of values) {
    const a = acc.get(p.pitch_type) ?? { n: 0, h: 0, v: 0 };
    a.n += 1;
    a.h += p.hBreak;
    a.v += p.vBreak;
    acc.set(p.pitch_type, a);
  }
  return Array.from(acc, ([pitch_type, a]) => ({
    pitch_type,
    n: a.n,
    hBreak: a.h / a.n,
    vBreak: a.v / a.n,
  }));
}

export function movementEncoding(
  values: ReturnType<typeof toMovementValues>,
  options: ResolvedVizOptions,
): PitchEncoding {
  // First-seen order, most-thrown first, so the legend reads like the arsenal.
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v.pitch_type, (counts.get(v.pitch_type) ?? 0) + 1);
  const types = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).map(([t]) => t);
  return pitchEncoding(types, options.theme, options.colorblind);
}

/** The two zero reference lines, solid hairlines in the axis token. */
export function zeroLineLayers(options: ResolvedVizOptions) {
  const t = THEMES[options.theme];
  return [
    { mark: { type: 'rule', stroke: t.axis, strokeWidth: 1 }, encoding: { x: { datum: 0 } } },
    { mark: { type: 'rule', stroke: t.axis, strokeWidth: 1 }, encoding: { y: { datum: 0 } } },
  ];
}

/**
 * Label positions for the mean markers. Labels sit to the right of their
 * marker at the marker's height; when two markers are close enough that
 * their labels would overprint (SI on CH for a pitcher whose means are
 * 2 in apart), the lower label is pushed down until it clears. Returns
 * the label's y in data units (inches) so the text layer can encode it.
 */
export function nudgeMeanLabels(
  means: ReturnType<typeof pitchMeans>,
  side: number,
  fontSize: number,
  markerSize: number,
): Array<{ pitch_type: string; labelBreak: number }> {
  const pxPerIn = side / (MOVEMENT_DOMAIN[1] - MOVEMENT_DOMAIN[0]);
  const labelH = fontSize * 1.25;
  // Widest label the pitch-type vocabulary produces is four glyphs (KC, SV, CS…).
  const labelW = fontSize * 0.65 * 4 + Math.sqrt(markerSize) / 2 + 6;
  // Top-down: each label is pushed below the previous one it collides with.
  const order = means.slice().sort((a, b) => b.vBreak - a.vBreak);
  const placed: Array<{ pitch_type: string; xPx: number; yPx: number }> = [];
  for (const m of order) {
    const xPx = m.hBreak * pxPerIn;
    let yPx = -m.vBreak * pxPerIn;
    for (const p of placed) {
      if (Math.abs(p.xPx - xPx) < labelW && yPx - p.yPx < labelH) yPx = p.yPx + labelH;
    }
    placed.push({ pitch_type: m.pitch_type, xPx, yPx });
  }
  return placed.map((p) => ({ pitch_type: p.pitch_type, labelBreak: -p.yPx / pxPerIn }));
}

/**
 * Mean markers, drawn LAST so no point cluster can bury them: a ring in
 * the surface color, the filled marker in the pitch color, and the pitch
 * label beside it with a surface-color halo. The audit found the old
 * hollow crosses were visible for one pitch type out of seven.
 */
export function meanMarkerLayers(
  means: ReturnType<typeof pitchMeans>,
  enc: PitchEncoding,
  options: ResolvedVizOptions,
) {
  const t = THEMES[options.theme];
  const d = AUDIENCE_DEFAULTS[options.audience];
  const markerSize = d.axisLabelFontSize * 14;
  // Color and shape are resolved here and passed through with `scale: null`
  // so these layers never touch the point layer's legend.
  const idx = new Map(enc.domain.map((p, i) => [p, i]));
  const labelY = new Map(
    nudgeMeanLabels(means, movementSide(options), d.axisTitleFontSize, markerSize).map((l) => [l.pitch_type, l.labelBreak]),
  );
  const resolved = means.map((m) => {
    const i = idx.get(m.pitch_type) ?? 0;
    return { ...m, color: enc.colorRange[i], shape: enc.shapeRange[i], labelBreak: labelY.get(m.pitch_type) ?? m.vBreak };
  });
  const color = { field: 'color', type: 'nominal', scale: null };
  const shape = enc.useShape ? { shape: { field: 'shape', type: 'nominal', scale: null } } : {};
  const xy = {
    x: { field: 'hBreak', type: 'quantitative' },
    y: { field: 'vBreak', type: 'quantitative' },
  };
  return [
    {
      data: { values: resolved },
      mark: { type: 'point', filled: true, size: markerSize * 1.9, color: t.surface, opacity: 1 },
      encoding: { ...xy, ...shape },
    },
    {
      data: { values: resolved },
      mark: { type: 'point', filled: true, size: markerSize, stroke: t.surface, strokeWidth: 2, opacity: 1 },
      encoding: { ...xy, color, ...shape },
    },
    {
      data: { values: resolved },
      mark: {
        type: 'text',
        align: 'left',
        baseline: 'middle',
        dx: Math.round(Math.sqrt(markerSize) / 2) + 6,
        fontSize: d.axisTitleFontSize,
        fontWeight: 'bold',
        color: t.ink,
        ...textHalo(options.theme),
      },
      encoding: {
        x: xy.x,
        y: { field: 'labelBreak', type: 'quantitative' },
        text: { field: 'pitch_type', type: 'nominal' },
      },
    },
  ];
}
