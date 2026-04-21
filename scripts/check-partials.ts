#!/usr/bin/env tsx
// Fails if any .hbs file under src/templates/reports/partials/ is orphaned
// (neither registered in src/commands/report.ts via Handlebars.registerPartial
// nor referenced as {{> name}} from a .hbs template).
//
// Prevents recurrence of the v0.9.0 footer-partial bug (commit 655991b) where
// footer.hbs existed, was packaged, and sat in the codebase for multiple
// releases without ever being wired into render output.

import { readFileSync, readdirSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..');
const partialsDir = join(repoRoot, 'src', 'templates', 'reports', 'partials');
const reportsDir = join(repoRoot, 'src', 'templates', 'reports');
const registrationFile = join(repoRoot, 'src', 'commands', 'report.ts');

function listHbs(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.hbs'))
    .map((e) => join(dir, e.name));
}

function partialNames(): string[] {
  return listHbs(partialsDir).map((p) => basename(p, '.hbs'));
}

function concatTemplateSources(): string {
  return listHbs(reportsDir)
    .map((p) => readFileSync(p, 'utf-8'))
    .join('\n');
}

function isRegistered(name: string, source: string): boolean {
  // Matches: Handlebars.registerPartial('name', ...) or "name" or `name`
  return new RegExp(`registerPartial\\(\\s*['"\`]${name}['"\`]`).test(source);
}

function isIncluded(name: string, source: string): boolean {
  // Matches: {{> name}} with optional whitespace
  return new RegExp(`\\{\\{>\\s*${name}\\s*\\}\\}`).test(source);
}

function main(): void {
  const names = partialNames();
  if (names.length === 0) {
    console.log('No partials under src/templates/reports/partials/ — nothing to check.');
    return;
  }

  const registrationSource = readFileSync(registrationFile, 'utf-8');
  const templateSources = concatTemplateSources();

  const orphans: string[] = [];
  for (const name of names) {
    if (!isRegistered(name, registrationSource) && !isIncluded(name, templateSources)) {
      orphans.push(name);
    }
  }

  if (orphans.length > 0) {
    console.error('[FAIL] Orphaned Handlebars partials detected:');
    for (const name of orphans) {
      console.error(`  - src/templates/reports/partials/${name}.hbs`);
      console.error(`    Not registered in src/commands/report.ts and not referenced as {{> ${name}}}.`);
    }
    console.error('\nFix: either wire the partial (Handlebars.registerPartial + {{> name}} in a template) or delete the file.');
    process.exit(1);
  }

  console.log(`[OK] All ${names.length} partial(s) wired: ${names.join(', ')}`);
}

main();
