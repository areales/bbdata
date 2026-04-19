import { describe, it, expect } from 'vitest';
import {
  isSourceEnabled,
  sourceConfigKey,
} from '../../src/config/config.js';
import { getDefaultConfig, type BbdataConfig } from '../../src/config/defaults.js';

function withSource(
  updates: Partial<BbdataConfig['sources']>,
): BbdataConfig {
  const config = getDefaultConfig();
  config.sources = { ...config.sources, ...updates };
  return config;
}

describe('sourceConfigKey', () => {
  it('maps kebab-case DataSource values to camelCase config keys', () => {
    expect(sourceConfigKey('savant')).toBe('savant');
    expect(sourceConfigKey('fangraphs')).toBe('fangraphs');
    expect(sourceConfigKey('mlb-stats-api')).toBe('mlbStatsApi');
    expect(sourceConfigKey('baseball-reference')).toBe('baseballReference');
  });

  it('returns null for stdin (not a configurable source)', () => {
    expect(sourceConfigKey('stdin')).toBeNull();
  });
});

describe('isSourceEnabled', () => {
  it('defaults — savant / fangraphs / mlb-stats-api enabled, baseball-reference disabled', () => {
    const config = getDefaultConfig();
    expect(isSourceEnabled(config, 'savant')).toBe(true);
    expect(isSourceEnabled(config, 'fangraphs')).toBe(true);
    expect(isSourceEnabled(config, 'mlb-stats-api')).toBe(true);
    expect(isSourceEnabled(config, 'baseball-reference')).toBe(false);
  });

  it('honors the camelCase key override even when the DataSource is kebab-case', () => {
    // The whole point of R2.1 — before 2026-04-19 the `sources.mlbStatsApi.enabled`
    // toggle was silently ignored because the resolver looked up `mlb-stats-api`
    // on an object keyed by `mlbStatsApi`.
    const config = withSource({
      mlbStatsApi: { enabled: false },
    });
    expect(isSourceEnabled(config, 'mlb-stats-api')).toBe(false);
    expect(isSourceEnabled(config, 'savant')).toBe(true);
  });

  it('returns true for stdin regardless of config (stdin is never operator-disabled)', () => {
    const config = withSource({
      savant: { enabled: false },
      fangraphs: { enabled: false },
      mlbStatsApi: { enabled: false },
      baseballReference: { enabled: false },
    });
    expect(isSourceEnabled(config, 'stdin')).toBe(true);
  });

  it('enabling baseball-reference flips the check', () => {
    const config = withSource({
      baseballReference: { enabled: true },
    });
    expect(isSourceEnabled(config, 'baseball-reference')).toBe(true);
  });
});
