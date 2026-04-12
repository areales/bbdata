import { z } from 'zod';

// --- Data Source Types ---

export type DataSource = 'savant' | 'fangraphs' | 'mlb-stats-api' | 'baseball-reference' | 'stdin';

// --- Pitch-level data (Statcast granularity) ---

export const PitchDataSchema = z.object({
  pitcher_id: z.string(),
  pitcher_name: z.string(),
  batter_id: z.string(),
  batter_name: z.string(),
  game_date: z.string(),
  pitch_type: z.string(),          // FF, SL, CH, CU, SI, FC, KC, FS, etc.
  release_speed: z.number(),       // mph
  release_spin_rate: z.number(),   // rpm
  pfx_x: z.number(),              // horizontal movement (inches)
  pfx_z: z.number(),              // vertical movement (inches)
  plate_x: z.number(),            // horizontal location
  plate_z: z.number(),            // vertical location
  launch_speed: z.number().nullable(),   // exit velocity (mph)
  launch_angle: z.number().nullable(),   // degrees
  hc_x: z.number().nullable(),    // Statcast hit coordinate x (horizontal)
  hc_y: z.number().nullable(),    // Statcast hit coordinate y (distance from home)
  description: z.string(),        // called_strike, swinging_strike, ball, foul, hit_into_play, etc.
  events: z.string().nullable(),  // single, double, home_run, strikeout, etc.
  bb_type: z.string().nullable(), // fly_ball, ground_ball, line_drive, popup
  stand: z.enum(['L', 'R']),      // batter handedness
  p_throws: z.enum(['L', 'R']),   // pitcher handedness
  estimated_ba: z.number().nullable(),   // xBA
  estimated_woba: z.number().nullable(), // xwOBA
  // Count / inning / PA fields — added for advance-sp tactical sections
  // (BBDATA-011). Optional+nullable: Savant CSV historically includes them
  // but consumer templates written before the extension should still
  // compile, and stdin-piped payloads without these fields should still
  // pass type-checking.
  inning: z.number().nullable().optional(),
  balls: z.number().nullable().optional(),         // balls before the pitch
  strikes: z.number().nullable().optional(),       // strikes before the pitch
  outs_when_up: z.number().nullable().optional(),  // outs at start of PA
  at_bat_number: z.number().nullable().optional(), // PA index within the game
  pitch_number: z.number().nullable().optional(),  // pitch index within the PA
});

export type PitchData = z.infer<typeof PitchDataSchema>;

// --- Aggregated player stats (FanGraphs/BBRef granularity) ---

export const PlayerStatsSchema = z.object({
  player_id: z.string(),
  player_name: z.string(),
  team: z.string(),
  season: z.number(),
  stat_type: z.enum(['batting', 'pitching', 'fielding']),
  stats: z.record(z.union([z.number(), z.string(), z.null()])),
});

export type PlayerStats = z.infer<typeof PlayerStatsSchema>;

// --- Player identity (cross-source resolution) ---

export interface PlayerId {
  mlbam_id: string;
  fangraphs_id?: string;
  bbref_id?: string;
  name: string;
  team?: string;
  position?: string;
}

// --- Query parameters passed to adapters ---

export interface AdapterQuery {
  player_name?: string;
  player_id?: string;
  team?: string;
  season: number;
  start_date?: string;       // YYYY-MM-DD
  end_date?: string;         // YYYY-MM-DD
  stat_type: 'batting' | 'pitching' | 'fielding';
  pitch_type?: string[];     // filter by pitch type codes
  min_pa?: number;
  min_ip?: number;
  metrics?: string[];        // specific stat columns to return
}

// --- Adapter fetch result ---

export interface AdapterResult<T = PitchData[] | PlayerStats[]> {
  data: T;
  source: DataSource;
  cached: boolean;
  fetchedAt: string;         // ISO 8601
  meta: {
    rowCount: number;
    season: number;
    query: AdapterQuery;
  };
}

// --- The adapter contract ---

export interface DataAdapter {
  readonly source: DataSource;
  readonly description: string;

  /** Can this adapter service this query type? */
  supports(query: AdapterQuery): boolean;

  /** Fetch data, checking cache first */
  fetch(query: AdapterQuery, options?: { bypassCache?: boolean }): Promise<AdapterResult>;

  /** Resolve a player name to this source's ID */
  resolvePlayer(name: string): Promise<PlayerId | null>;
}

// --- Pitch type mappings (normalize across sources) ---

export const PITCH_TYPE_MAP: Record<string, string> = {
  FF: 'Four-Seam Fastball',
  SI: 'Sinker',
  FC: 'Cutter',
  SL: 'Slider',
  CU: 'Curveball',
  KC: 'Knuckle Curve',
  CH: 'Changeup',
  FS: 'Splitter',
  KN: 'Knuckleball',
  EP: 'Eephus',
  SC: 'Screwball',
  ST: 'Sweeper',
  SV: 'Slurve',
};

export function pitchTypeName(code: string): string {
  return PITCH_TYPE_MAP[code.toUpperCase()] ?? code;
}
