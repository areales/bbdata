import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { ConfigSchema, getDefaultConfig, type BbdataConfig } from './defaults.js';
import type { DataSource } from '../adapters/types.js';

// DataSource values are kebab-case (`mlb-stats-api`); config.sources keys are
// camelCase (`mlbStatsApi`) because the config schema was authored to match
// idiomatic JS field naming. This table is the single source of truth for
// that mapping so every consumer stays in sync.
const SOURCE_CONFIG_KEYS = {
  'savant': 'savant',
  'fangraphs': 'fangraphs',
  'mlb-stats-api': 'mlbStatsApi',
  'baseball-reference': 'baseballReference',
} as const satisfies Record<Exclude<DataSource, 'stdin'>, keyof BbdataConfig['sources']>;

const BBDATA_DIR = join(homedir(), '.bbdata');
const CONFIG_PATH = join(BBDATA_DIR, 'config.json');

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export function getConfigDir(): string {
  return BBDATA_DIR;
}

export function getConfig(): BbdataConfig {
  ensureDir(BBDATA_DIR);

  if (!existsSync(CONFIG_PATH)) {
    const defaults = getDefaultConfig();
    writeFileSync(CONFIG_PATH, JSON.stringify(defaults, null, 2), 'utf-8');
    return defaults;
  }

  try {
    const raw = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
    return ConfigSchema.parse(raw);
  } catch {
    // If config is corrupted, return defaults without overwriting
    return getDefaultConfig();
  }
}

export function setConfig(updates: Partial<BbdataConfig>): BbdataConfig {
  const current = getConfig();
  const merged = { ...current, ...updates };
  const validated = ConfigSchema.parse(merged);

  ensureDir(BBDATA_DIR);
  writeFileSync(CONFIG_PATH, JSON.stringify(validated, null, 2), 'utf-8');

  return validated;
}

export function getCacheDir(): string {
  const config = getConfig();
  const dir = config.cache.directory || join(BBDATA_DIR, 'cache');
  ensureDir(dir);
  return dir;
}

export function getTemplatesDir(): string {
  const config = getConfig();
  const dir = config.templates.directory || join(BBDATA_DIR, 'templates');
  ensureDir(dir);
  return dir;
}

/**
 * Returns the `config.sources.<key>` path fragment for a given DataSource,
 * or `null` for `stdin` (which is not a configurable network source).
 * Callers use this to render user-facing error messages that point at the
 * exact config key to edit.
 */
export function sourceConfigKey(source: DataSource): keyof BbdataConfig['sources'] | null {
  if (source === 'stdin') return null;
  return SOURCE_CONFIG_KEYS[source as Exclude<DataSource, 'stdin'>];
}

/**
 * Whether a source is currently enabled per user config. `stdin` is always
 * allowed — it's a local data path and never something operators disable.
 */
export function isSourceEnabled(config: BbdataConfig, source: DataSource): boolean {
  if (source === 'stdin') return true;
  const key = SOURCE_CONFIG_KEYS[source as Exclude<DataSource, 'stdin'>];
  if (!key) return false;
  return config.sources[key].enabled;
}
