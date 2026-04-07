import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { ConfigSchema, getDefaultConfig, type BbdataConfig } from './defaults.js';

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
