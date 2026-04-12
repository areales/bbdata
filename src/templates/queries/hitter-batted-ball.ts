import { registerTemplate, type QueryTemplate } from './registry.js';
import type { PitchData } from '../../adapters/types.js';

// Statcast event codes that denote a batted-ball event (BBE).
// Anything in this set contributes to the EV / Hard Hit / Barrel / bb_type rollups.
// Foul balls are *not* BBEs, so their `events` is null and they're excluded automatically.
const BATTED_BALL_EVENTS: ReadonlySet<string> = new Set([
  'single',
  'double',
  'triple',
  'home_run',
  'field_out',
  'force_out',
  'grounded_into_double_play',
  'double_play',
  'triple_play',
  'sac_fly',
  'sac_fly_double_play',
  'sac_bunt',
  'sac_bunt_double_play',
  'field_error',
  'fielders_choice',
  'fielders_choice_out',
]);

// Savant barrel definition: a "perfect" combination of exit velocity and
// launch angle. Minimum EV is 98 mph at LA 26–30°; each additional mph above
// 98 widens the acceptable LA window. At 116 mph and above, any LA between
// 8° and 50° qualifies. Below 98 mph, nothing qualifies regardless of angle.
// Source: https://baseballsavant.mlb.com/glossary (Barrel)
const BARREL_LA_RANGE_BY_EV: Readonly<Record<number, readonly [number, number]>> = {
  98: [26, 30],
  99: [25, 31],
  100: [24, 33],
  101: [23, 34],
  102: [22, 35],
  103: [21, 36],
  104: [20, 37],
  105: [19, 38],
  106: [18, 39],
  107: [17, 40],
  108: [16, 41],
  109: [15, 42],
  110: [14, 43],
  111: [13, 44],
  112: [12, 45],
  113: [11, 46],
  114: [10, 47],
  115: [9, 48],
};
const BARREL_LA_RANGE_116_PLUS: readonly [number, number] = [8, 50];

function isBarrel(launchSpeed: number, launchAngle: number): boolean {
  if (launchSpeed < 98) return false;
  const bucket = Math.floor(launchSpeed);
  const range = bucket >= 116 ? BARREL_LA_RANGE_116_PLUS : BARREL_LA_RANGE_BY_EV[bucket];
  return launchAngle >= range[0] && launchAngle <= range[1];
}

const template: QueryTemplate = {
  id: 'hitter-batted-ball',
  name: 'Hitter Batted Ball Profile',
  category: 'hitter',
  description: 'Exit velocity, launch angle, hard hit rate, barrel rate, batted ball distribution',
  preferredSources: ['savant', 'fangraphs'],
  requiredParams: ['player'],
  optionalParams: ['season'],
  examples: [
    'bbdata query hitter-batted-ball --player "Aaron Judge" --season 2025',
    'bbdata query hitter-batted-ball --player "Juan Soto"',
  ],

  buildQuery(params) {
    return {
      player_name: params.player,
      season: params.season ?? new Date().getFullYear(),
      stat_type: 'batting',
    };
  },

  columns() {
    return ['Metric', 'Value'];
  },

  transform(data) {
    const pitches = data as PitchData[];
    // Filter to batted-ball events (BBE). The prior implementation used
    // `launch_speed > 0`, which admitted foul balls (they carry tracked launch
    // speed but are not BBEs) into the denominator and pulled averages down.
    const batted = pitches.filter((p) => p.events != null && BATTED_BALL_EVENTS.has(p.events));

    if (batted.length === 0) return [];

    // Savant's public Hard Hit / Barrel / Avg EV use BBE as the denominator.
    // Events with null launch data (rare — failed tracking) are excluded from
    // the numerator but remain in the denominator, matching savant.com.
    const evs = batted.filter((p) => p.launch_speed != null).map((p) => p.launch_speed!);
    const las = batted.filter((p) => p.launch_angle != null).map((p) => p.launch_angle!);
    const avgEv = evs.length > 0 ? evs.reduce((s, v) => s + v, 0) / evs.length : 0;
    const avgLa = las.length > 0 ? las.reduce((s, v) => s + v, 0) / las.length : 0;
    const maxEv = evs.length > 0 ? Math.max(...evs) : 0;

    const hardHit = batted.filter((p) => p.launch_speed != null && p.launch_speed >= 95).length;
    const barrels = batted.filter(
      (p) =>
        p.launch_speed != null &&
        p.launch_angle != null &&
        isBarrel(p.launch_speed, p.launch_angle),
    ).length;

    const linedrives = batted.filter((p) => p.bb_type === 'line_drive').length;
    const flyballs = batted.filter((p) => p.bb_type === 'fly_ball').length;
    const groundballs = batted.filter((p) => p.bb_type === 'ground_ball').length;
    const popups = batted.filter((p) => p.bb_type === 'popup').length;

    return [
      { Metric: 'Batted Balls', Value: batted.length },
      { Metric: 'Avg Exit Velocity', Value: avgEv.toFixed(1) + ' mph' },
      { Metric: 'Max Exit Velocity', Value: maxEv.toFixed(1) + ' mph' },
      { Metric: 'Avg Launch Angle', Value: avgLa.toFixed(1) + '°' },
      { Metric: 'Hard Hit Rate (95+ mph)', Value: ((hardHit / batted.length) * 100).toFixed(1) + '%' },
      { Metric: 'Barrel Rate', Value: ((barrels / batted.length) * 100).toFixed(1) + '%' },
      { Metric: 'Line Drive %', Value: ((linedrives / batted.length) * 100).toFixed(1) + '%' },
      { Metric: 'Fly Ball %', Value: ((flyballs / batted.length) * 100).toFixed(1) + '%' },
      { Metric: 'Ground Ball %', Value: ((groundballs / batted.length) * 100).toFixed(1) + '%' },
      { Metric: 'Popup %', Value: ((popups / batted.length) * 100).toFixed(1) + '%' },
    ];
  },
};

registerTemplate(template);
