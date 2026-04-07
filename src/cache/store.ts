import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { getCacheDir } from '../config/config.js';
import { log } from '../utils/logger.js';

// sql.js is loaded lazily to avoid blocking startup
let db: any = null;
let initFailed = false;

async function getDb(): Promise<any> {
  if (db) return db;
  if (initFailed) return null;

  try {
    const initSqlJs = (await import('sql.js')).default;
    const SQL = await initSqlJs();

    const cacheDir = getCacheDir();
    const dbPath = join(cacheDir, 'bbdata.sqlite');

    if (existsSync(dbPath)) {
      const buffer = readFileSync(dbPath);
      db = new SQL.Database(buffer);
    } else {
      db = new SQL.Database();
    }

    // Run schema
    const schemaPath = join(dirname(fileURLToPath(import.meta.url)), 'schema.sql');
    if (existsSync(schemaPath)) {
      const schema = readFileSync(schemaPath, 'utf-8');
      db.run(schema);
    } else {
      // Inline schema fallback for bundled distribution
      db.run(`
        CREATE TABLE IF NOT EXISTS response_cache (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          source TEXT NOT NULL,
          query_hash TEXT NOT NULL,
          query_params TEXT NOT NULL,
          response_data TEXT NOT NULL,
          fetched_at TEXT NOT NULL,
          expires_at TEXT NOT NULL,
          UNIQUE(source, query_hash)
        );
        CREATE TABLE IF NOT EXISTS player_ids (
          mlbam_id TEXT PRIMARY KEY,
          fangraphs_id TEXT,
          bbref_id TEXT,
          player_name TEXT NOT NULL,
          team TEXT,
          position TEXT,
          updated_at TEXT NOT NULL
        );
      `);
    }

    saveDb();
    log.debug('Cache initialized');
    return db;
  } catch (error) {
    initFailed = true;
    log.debug(`Cache unavailable: ${error}. Running without cache.`);
    return null;
  }
}

function saveDb(): void {
  if (!db) return;
  try {
    const { writeFileSync, mkdirSync } = require('node:fs');
    const cacheDir = getCacheDir();
    mkdirSync(cacheDir, { recursive: true });
    const data = db.export();
    writeFileSync(join(cacheDir, 'bbdata.sqlite'), Buffer.from(data));
  } catch {
    // Non-critical — cache save failed silently
  }
}

export function queryHash(source: string, params: Record<string, unknown>): string {
  const normalized = JSON.stringify(params, Object.keys(params).sort());
  return createHash('sha256').update(`${source}:${normalized}`).digest('hex').slice(0, 16);
}

export async function getCached(
  source: string,
  params: Record<string, unknown>,
): Promise<string | null> {
  const database = await getDb();
  if (!database) return null;

  const hash = queryHash(source, params);
  const now = new Date().toISOString();

  try {
    const result = database.exec(
      `SELECT response_data FROM response_cache
       WHERE source = ? AND query_hash = ? AND expires_at > ?`,
      [source, hash, now],
    );
    if (result.length > 0 && result[0].values.length > 0) {
      log.debug(`Cache hit for ${source}:${hash}`);
      return result[0].values[0][0] as string;
    }
  } catch {
    // Cache read failed — proceed without cache
  }

  return null;
}

export async function setCache(
  source: string,
  params: Record<string, unknown>,
  data: string,
  maxAgeDays: number = 30,
): Promise<void> {
  const database = await getDb();
  if (!database) return;

  const hash = queryHash(source, params);
  const now = new Date();
  const expires = new Date(now.getTime() + maxAgeDays * 24 * 60 * 60 * 1000);

  try {
    database.run(
      `INSERT OR REPLACE INTO response_cache (source, query_hash, query_params, response_data, fetched_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [source, hash, JSON.stringify(params), data, now.toISOString(), expires.toISOString()],
    );
    saveDb();
    log.debug(`Cached ${source}:${hash}`);
  } catch {
    // Cache write failed — non-critical
  }
}

export async function cachePlayerIds(player: {
  mlbam_id: string;
  fangraphs_id?: string;
  bbref_id?: string;
  name: string;
  team?: string;
  position?: string;
}): Promise<void> {
  const database = await getDb();
  if (!database) return;

  try {
    database.run(
      `INSERT OR REPLACE INTO player_ids (mlbam_id, fangraphs_id, bbref_id, player_name, team, position, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        player.mlbam_id,
        player.fangraphs_id ?? null,
        player.bbref_id ?? null,
        player.name,
        player.team ?? null,
        player.position ?? null,
        new Date().toISOString(),
      ],
    );
    saveDb();
  } catch {
    // Non-critical
  }
}
