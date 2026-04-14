import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { getStdinAdapter } from '../adapters/index.js';
import { parseSavantCsv } from '../adapters/savant-csv.js';

/**
 * Load a file into the stdin adapter, dispatching by extension.
 *
 * - `.json` — parsed as JSON (same shape as piped `--stdin`: either a raw
 *   array of records, or `{ data: [...], player?: {...} }`).
 * - `.csv` — parsed with the Savant CSV schema (column names matching
 *   Savant's search export). Rows with empty `pitch_type` or non-regular-
 *   season `game_type` are filtered out.
 *
 * Any other extension throws — students should convert first rather than
 * have bbdata silently guess.
 */
export function loadDataFile(path: string): void {
  const raw = readFileSync(path, 'utf-8');
  const ext = extname(path).toLowerCase();
  const adapter = getStdinAdapter();

  if (ext === '.json') {
    adapter.load(raw);
    return;
  }

  if (ext === '.csv') {
    const records = parseSavantCsv(raw);
    adapter.loadRecords(records);
    return;
  }

  throw new Error(
    `Unsupported --data extension "${ext || '(none)'}". Use .json or .csv.`,
  );
}
