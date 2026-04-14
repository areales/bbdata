import { parse } from 'csv-parse/sync';
import type { PitchData } from './types.js';

// Nullable numeric parse that preserves legitimate zeros (e.g. balls=0,
// strikes=0, outs_when_up=0 are valid count/PA states) and rejects NaN from
// malformed cells. Distinct from the `Number(x) || null` idiom used for fields
// like launch_speed where 0 is not a meaningful value.
function numOrNull(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse a Baseball Savant search-CSV payload into PitchData records.
 *
 * Shared between the savant adapter (which fetches the CSV over HTTP) and the
 * `--data <path>.csv` flag (which reads an identically-shaped CSV off disk).
 * Any student-supplied CSV exported from Savant's search tool will round-trip
 * through this function cleanly.
 *
 * Rows with empty `pitch_type` (intentional walks, pitchouts, automatic balls)
 * or a non-regular-season `game_type` are dropped — matches Savant adapter
 * filtering (BBDATA-007).
 */
export function parseSavantCsv(csvText: string): PitchData[] {
  const rawRows = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    cast: true,
    cast_date: false,
  }) as Record<string, unknown>[];

  const filteredRows = rawRows.filter((row) => {
    if (!row.pitch_type || String(row.pitch_type).trim() === '') return false;
    if (row.game_type !== undefined && String(row.game_type) !== 'R') return false;
    return true;
  });

  return filteredRows.map((row) => ({
    pitcher_id: String(row.pitcher ?? ''),
    pitcher_name: String(row.player_name ?? ''),
    batter_id: String(row.batter ?? ''),
    batter_name: String(row.batter_name || '') || (row.batter ? `Unknown (#${row.batter})` : 'Unknown'),
    game_date: String(row.game_date ?? ''),
    pitch_type: String(row.pitch_type ?? ''),
    release_speed: Number(row.release_speed) || 0,
    release_spin_rate: Number(row.release_spin_rate) || 0,
    pfx_x: Number(row.pfx_x) || 0,
    pfx_z: Number(row.pfx_z) || 0,
    plate_x: Number(row.plate_x) || 0,
    plate_z: Number(row.plate_z) || 0,
    launch_speed: row.launch_speed != null ? Number(row.launch_speed) || null : null,
    launch_angle: row.launch_angle != null ? Number(row.launch_angle) || null : null,
    hc_x: row.hc_x != null && row.hc_x !== '' ? Number(row.hc_x) || null : null,
    hc_y: row.hc_y != null && row.hc_y !== '' ? Number(row.hc_y) || null : null,
    description: String(row.description ?? ''),
    events: row.events ? String(row.events) : null,
    bb_type: row.bb_type ? String(row.bb_type) : null,
    stand: (String(row.stand ?? 'R') as 'L' | 'R'),
    p_throws: (String(row.p_throws ?? 'R') as 'L' | 'R'),
    estimated_ba: row.estimated_ba_using_speedangle != null
      ? Number(row.estimated_ba_using_speedangle) || null
      : null,
    estimated_woba: row.estimated_woba_using_speedangle != null
      ? Number(row.estimated_woba_using_speedangle) || null
      : null,
    inning: numOrNull(row.inning),
    balls: numOrNull(row.balls),
    strikes: numOrNull(row.strikes),
    outs_when_up: numOrNull(row.outs_when_up),
    at_bat_number: numOrNull(row.at_bat_number),
    pitch_number: numOrNull(row.pitch_number),
  }));
}
