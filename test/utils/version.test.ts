import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { CLI_VERSION } from '../../src/utils/version.js';
import { program } from '../../src/cli.js';

/**
 * Regression test for the version-string bug (fixed in a6cdcde):
 * `src/cli.ts` previously hardcoded `.version('0.1.0')` while package.json
 * drifted to 0.4.0, so `bbdata --version` lied about the running version.
 *
 * These tests close the loop by asserting that both the CLI_VERSION
 * constant and the Commander program's `.version()` match the package.json
 * source of truth.
 */

const pkg = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf-8'),
) as { version: string };

describe('CLI_VERSION', () => {
  it('matches package.json version', () => {
    expect(CLI_VERSION).toBe(pkg.version);
  });

  it('is a non-empty semver-ish string (not the 0.0.0 fallback)', () => {
    expect(CLI_VERSION).toMatch(/^\d+\.\d+\.\d+/);
    expect(CLI_VERSION).not.toBe('0.0.0');
  });
});

describe('Commander program version', () => {
  it('program.version() matches package.json (catches hardcoded regressions in cli.ts)', () => {
    expect(program.version()).toBe(pkg.version);
  });
});
