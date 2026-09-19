import type { VizTheme } from './types.js';

/**
 * Visual tokens for the chart family (2026-09 redesign).
 *
 * One family, three themes. `light` is the base every audience renders in
 * by default; `dark` is the same marks on a dark surface with the palette
 * re-stepped for it; `print` is grayscale for photocopies and grayscale
 * reports, where shape carries identity instead of hue.
 *
 * Palette values are the dataviz reference palette, validated with its
 * `validate_palette.js` (OKLab, CVD simulation) on 2026-09-18:
 *   - the six-slot pitch palette passes the all-pairs normal-vision floor
 *     in light mode; the seventh slot (brown) passes it too but sits in the
 *     CVD warn band, which is legal only with a secondary channel — the
 *     movement charts carry direct labels at every mean and switch on shape
 *     encoding whenever the plotted set needs it (see `pitchEncoding`).
 *   - the four-slot spray palette (blue / yellow / violet / red) passes every
 *     check in light mode.
 *   - no seven-hue dark set clears the all-pairs floor, so the dark theme
 *     always adds shape as a redundant channel.
 * Text never wears a series color: labels use the ink tokens below.
 */
export interface ThemeTokens {
  /** Chart surface (Vega `background`). */
  surface: string;
  /** Primary text. */
  ink: string;
  /** Secondary text: axis titles, captions. */
  muted: string;
  /** Hairline gridlines, one step off the surface. */
  grid: string;
  /** Axis domain/tick lines, zero lines, field guides. */
  axis: string;
  /** Neutral mark color (outs, "other"). */
  neutral: string;
  /** Sequential ramp for magnitude (light → dark), used by zone. */
  sequential: string[];
  /** Single-series accent (rolling lines, ranked bars). */
  accent: string;
}

export const THEMES: Record<VizTheme, ThemeTokens> = {
  light: {
    surface: '#ffffff',
    ink: '#0b0b0b',
    muted: '#52514e',
    grid: '#e1e0d9',
    axis: '#c3c2b7',
    neutral: '#b5b3ad',
    sequential: ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b'],
    accent: '#2a78d6',
  },
  dark: {
    surface: '#1a1a19',
    ink: '#ffffff',
    muted: '#c3c2b7',
    grid: '#2c2c2a',
    axis: '#383835',
    neutral: '#6f6e69',
    sequential: ['#1c3352', '#1c5cab', '#256abf', '#3987e5', '#6da7ec', '#9ec5f4', '#cde2fb'],
    accent: '#3987e5',
  },
  print: {
    surface: '#ffffff',
    ink: '#000000',
    muted: '#444444',
    grid: '#e6e6e6',
    axis: '#bdbdbd',
    neutral: '#c8c8c8',
    sequential: ['#f2f2f2', '#d9d9d9', '#bdbdbd', '#969696', '#737373', '#525252', '#252525'],
    accent: '#252525',
  },
};

/**
 * Pitch-type → color. Fixed so color follows the pitch, not its rank in a
 * given arsenal: a slider is the same blue on every pitcher's chart.
 * Families share a temperature — fastballs warm, breaking balls cool,
 * offspeed green — so a coach can read the family before the label.
 * Types past the validated seven reuse a family color; `pitchEncoding`
 * turns on shape whenever two plotted types would share a hue.
 */
const PITCH_COLORS_LIGHT: Record<string, string> = {
  FF: '#e34948', // four-seam        red
  SI: '#eda100', // sinker           yellow
  FC: '#6b4c2a', // cutter           brown
  SL: '#2a78d6', // slider           blue
  ST: '#6b4c2a', // sweeper          brown (rare with FC in one arsenal)
  CU: '#4a3aa7', // curve            violet
  KC: '#4a3aa7', // knuckle-curve    violet (shape separates it from CU)
  SV: '#2a78d6', // slurve           blue   (shape separates it from SL)
  CH: '#1baf7a', // changeup         aqua
  FS: '#008300', // splitter         green
  FO: '#008300', // forkball         green
  SC: '#1baf7a', // screwball        aqua
};
const PITCH_COLORS_DARK: Record<string, string> = {
  FF: '#e66767',
  SI: '#c98500',
  FC: '#a0764a',
  SL: '#3987e5',
  ST: '#a0764a',
  CU: '#9085e9',
  KC: '#9085e9',
  SV: '#3987e5',
  CH: '#199e70',
  FS: '#3cae3c',
  FO: '#3cae3c',
  SC: '#199e70',
};
const PITCH_GRAYS: Record<string, string> = {
  FF: '#252525',
  SI: '#525252',
  FC: '#737373',
  SL: '#252525',
  ST: '#737373',
  CU: '#525252',
  KC: '#969696',
  SV: '#969696',
  CH: '#737373',
  FS: '#969696',
  FO: '#525252',
  SC: '#252525',
};
/** Shapes are the redundant channel; every type gets its own. */
const PITCH_SHAPES: Record<string, string> = {
  FF: 'circle',
  SI: 'square',
  FC: 'diamond',
  SL: 'triangle-up',
  ST: 'triangle-down',
  CU: 'cross',
  KC: 'triangle-right',
  SV: 'triangle-left',
  CH: 'diamond',
  FS: 'square',
  FO: 'cross',
  SC: 'circle',
};

const FALLBACK_SHAPES = ['circle', 'square', 'diamond', 'triangle-up', 'triangle-down', 'cross', 'triangle-right', 'triangle-left'];

export interface PitchEncoding {
  /** Pitch types present, in first-seen order. */
  domain: string[];
  colorRange: string[];
  shapeRange: string[];
  /** Whether the point layer should encode shape as well as color. */
  useShape: boolean;
}

/**
 * Resolve the color (and, when needed, shape) scales for a set of pitch
 * types. Shape is on for the print and dark themes, for `--colorblind`, and
 * whenever two plotted types would otherwise share a hue.
 */
export function pitchEncoding(
  types: string[],
  theme: VizTheme,
  colorblind: boolean,
): PitchEncoding {
  const domain = Array.from(new Set(types));
  const colors =
    theme === 'print' ? PITCH_GRAYS : theme === 'dark' ? PITCH_COLORS_DARK : PITCH_COLORS_LIGHT;
  const neutral = THEMES[theme].neutral;
  const colorRange = domain.map((t) => colors[t] ?? neutral);
  const shapeRange = domain.map((t, i) => PITCH_SHAPES[t] ?? FALLBACK_SHAPES[i % FALLBACK_SHAPES.length]);
  const collides = new Set(colorRange).size < colorRange.length;
  return {
    domain,
    colorRange,
    shapeRange,
    useShape: theme !== 'light' || colorblind || collides,
  };
}

/** Batted-ball result → display label. Everything that isn't a hit is an out. */
export const RESULT_LABELS: Record<string, string> = {
  single: 'Single',
  double: 'Double',
  triple: 'Triple',
  home_run: 'Home run',
};
export const RESULT_DOMAIN = ['Single', 'Double', 'Triple', 'Home run', 'Out'];
export const RESULT_SHAPES = ['circle', 'square', 'triangle-up', 'diamond', 'cross'];

export function resultColors(theme: VizTheme): string[] {
  const t = THEMES[theme];
  switch (theme) {
    case 'dark':
      return ['#3987e5', '#c98500', '#199e70', '#e66767', t.neutral];
    case 'print':
      return ['#252525', '#525252', '#737373', '#000000', t.neutral];
    default:
      return ['#2a78d6', '#eda100', '#4a3aa7', '#e34948', t.neutral];
  }
}

export function resultLabel(event: string | null | undefined): string {
  if (!event) return 'Out';
  return RESULT_LABELS[event] ?? 'Out';
}

/**
 * Categorical range for charts that color by an arbitrary nominal field
 * (comparison players). The reference palette's fixed slot order.
 */
export function categoricalRange(theme: VizTheme): string[] {
  switch (theme) {
    case 'dark':
      return ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'];
    case 'print':
      return ['#252525', '#737373', '#a6a6a6', '#525252', '#8c8c8c', '#3d3d3d', '#bdbdbd', '#000000'];
    default:
      return ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'];
  }
}

/** Halo stroke for text drawn over marks: the surface color, so it reads as a gap. */
export function textHalo(theme: VizTheme): { stroke: string; strokeWidth: number; strokeOpacity: number; paintOrder: 'stroke' } {
  return { stroke: THEMES[theme].surface, strokeWidth: 3, strokeOpacity: 0.9, paintOrder: 'stroke' };
}

/** Baseball rate formatting: .312, not 0.312. Vega expression for axis/text labels. */
export const RATE_LABEL_EXPR = "replace(format(datum.value, '.3f'), /^(-?)0\\./, '$1.')";
export function formatRate(v: number): string {
  return v.toFixed(3).replace(/^(-?)0\./, '$1.');
}
