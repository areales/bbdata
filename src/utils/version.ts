import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Resolve the CLI version from package.json at load time.
 *
 * Why walk up instead of a fixed relative path: with tsup's `splitting: false`,
 * `cli.ts` is inlined into `dist/bin/bbdata.js` at build time, so
 * `import.meta.url` resolves to a different depth than at dev time (where
 * `tsx` runs `src/cli.ts` directly). Walking up until we find a `package.json`
 * whose `name === 'bbdata'` handles both layouts and also avoids
 * accidentally picking up a consumer's package.json if bbdata is ever
 * bundled inside another app.
 */
function resolveCliVersion(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    try {
      const raw = readFileSync(join(dir, 'package.json'), 'utf8');
      const parsed = JSON.parse(raw) as { name?: string; version?: string };
      if (parsed.name === 'bbdata' && parsed.version) {
        return parsed.version;
      }
    } catch {
      // package.json not found at this level — keep walking
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return '0.0.0';
}

export const CLI_VERSION = resolveCliVersion();
