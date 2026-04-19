import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { createStdinAdapter } from '../adapters/index.js';
import type { StdinAdapter } from '../adapters/stdin.js';
import { parseSavantCsv } from '../adapters/savant-csv.js';

/**
 * Load a file into a fresh stdin adapter, dispatching by extension, and
 * return the loaded adapter. The caller is responsible for passing it to
 * `resolveAdapters(..., { stdin: adapter })` so the query layer picks it up.
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
export function loadDataFile(path: string): StdinAdapter {
  const raw = readFileSync(path, 'utf-8');
  const ext = extname(path).toLowerCase();
  const adapter = createStdinAdapter();

  if (ext === '.json') {
    adapter.load(raw);
    return adapter;
  }

  if (ext === '.csv') {
    const records = parseSavantCsv(raw);
    adapter.loadRecords(records);
    return adapter;
  }

  throw new Error(
    `Unsupported --data extension "${ext || '(none)'}". Use .json or .csv.`,
  );
}
