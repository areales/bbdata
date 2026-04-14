# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Baseball data CLI (`bbdata`) for querying stats, generating scouting reports, and building analytics pipelines. Serves both human users (table/markdown output) and AI agents (JSON envelope output). Built with Commander.js, TypeScript, ESM-only.

## Commands

```powershell
npm run dev -- query pitcher-arsenal --player "Name"   # run via tsx
npm run build                                           # build with tsup
npm test                                                # vitest (all tests)
npx vitest run test/adapters/savant.test.ts             # single test file
npx vitest run -t "test name pattern"                   # single test by name
npm run test:watch                                      # vitest watch mode
npm run lint                                            # eslint
npm run typecheck                                       # tsc --noEmit
```

## Architecture

### Dual Export Pattern (Commands)

Every command in `src/commands/` exports **two interfaces** from the same implementation:

- **Programmatic function** (`query()`, `report()`) — takes typed options, returns `{ data, formatted, meta }`. Exported from `src/index.ts` for library consumers and agents.
- **CLI registration** (`registerQueryCommand(program)`) — Commander.js wiring that wraps the programmatic function. Only used by `src/cli.ts`.

### Data Flow

```
CLI options → Command → Template.buildQuery() → Adapter.fetch() → Template.transform() → Formatter → stdout
```

1. **Template** (looked up from registry by ID) defines what to fetch and how to transform it
2. **Adapter** selection: `resolveAdapters(preferredSources)` returns adapters in preference order; query command tries each until one succeeds (fallback chain)
3. **Formatter** is separate from transformation — templates handle business logic, formatters handle presentation

### Key Components

- **Adapters** (`src/adapters/`): Implement `DataAdapter` interface (`supports()`, `fetch()`, `resolvePlayer()`). Savant provides pitch-level CSV data; MLB Stats API provides season-level JSON and serves as universal fallback for player resolution.
- **Query Templates** (`src/templates/queries/`): Self-registering — each template calls `registerTemplate()` on import. Collected via side-effect imports in `index.ts`. Define `buildQuery()`, `transform()`, `columns()`.
- **Report Templates** (`src/templates/reports/`): Define `dataRequirements` (which query templates to run), load `.hbs` Handlebars files for rendering. Check user directory first, fall back to bundled templates.
- **Formatters** (`src/formatters/`): JSON (default, `{ data, meta }` envelope), table, CSV, markdown.
- **Cache** (`src/cache/`): SQLite via sql.js (WASM), in-process. Gracefully degrades — if sql.js fails to load, sets `initFailed=true` and continues without cache. SHA256 key from `source:params`.

### Logger Discipline

`log.info()`/`debug()`/`warn()`/`error()` write to **stderr** (decorative, colored). `log.data()` writes to **stdout** (raw output for pipes/agents). This split is critical — never log decorative output to stdout.

## Conventions

- ESM modules (`"type": "module"` in package.json) — all imports use `.js` extension
- `--format json` output uses `{ data, meta }` envelope
- Config at `~/.bbdata/config.json`, validated with Zod; corrupt config returns defaults
- `BBDATA_DEBUG` env var enables debug logging

## Testing Patterns

Tests use vitest with aggressive mocking. Adapters mock HTTP layers; commands mock entire adapters. Templates self-register via side-effect imports, so import order matters — import templates before mocking adapters.

## Releasing

```powershell
npm version patch                         # or minor/major — bumps package.json + package-lock.json, commits, tags (one step)
git push --follow-tags origin main        # ship commit and tag together
npm publish                                # prepublishOnly runs build + typecheck + test
npm view bbdata-cli@<version> version     # verify the publish landed
```

**Every release also updates `TEST_PLAN.md`.** Before `npm publish`, add a new section for the version with live smoke-test rows for any new feature or flag — this catches the gaps between unit-test mocks and the real adapter/CLI surface. After `npm publish`, run the new section's rows against the live registry build to confirm nothing regressed between `prepublishOnly` and publish. Prior-version sections stay as regression baselines and are re-run whenever a later change touches the same subsystem.

**Every release also reconciles `TASKS.md`.** Before `npm version`, move any items completed this cycle from the Priority 1–4 sections into a "Shipped in vX.Y.Z" section at the top, with one-line evidence pointers (`file:line` or commit hash). The release flow already forces you to touch CHANGELOG.md and TEST_PLAN.md; TASKS.md needs the same discipline or the backlog drifts silently across releases (v0.7.0 and v0.7.1 both shipped without crossing off the nine items they completed).

- **Never hand-edit the version field.** `npm version` is atomic across `package.json` and `package-lock.json` — hand edits drift the lockfile.
- **If the release moves a dep between `dependencies` and `devDependencies`,** run `npm install` once before `npm version` so the lockfile re-sorts and re-tags the `dev: true` flags. `npm version` only touches the version field — it won't rewrite the dep-section membership, so a stale lockfile will ship with the wrong section and fail installs of consumers who filter by prod deps.
- **Run `npm whoami` before `npm version`** to fail fast on stale auth. If it returns E401, run `npm login` first. Discovering the 2FA session is stale *after* `npm version` has already bumped and tagged means the commit is live but unpublished — you either publish later (window between bump and publish widens) or bump again (e.g., 0.7.1 → 0.7.2) since npm refuses to overwrite an already-tagged-but-unpublished version once the tarball is built.
- **Do not re-enable the `Stop` auto-commit hook** (removed in `cbdfddb`). It raced `npm version`'s two-file write and produced lockfile drift (0.3.0 and 0.4.0 shipped with `package-lock.json` stuck at 0.2.0). The hook script is still at `.claude/hooks/auto-commit.ps1` but is unreferenced from `.claude/settings.json`.
- **Do not use `--ignore-scripts` on publish** unless you've already run `npm run build && npm run typecheck && npm test` manually in the same session. The only legitimate reason to skip `prepublishOnly` is to minimize the window between 2FA OTP generation and npm's registry validation.
- **Version string wiring:** `src/utils/version.ts` walks up to find `package.json` at load time; `src/cli.ts` and `src/commands/report.ts` import `CLI_VERSION` from it. `test/utils/version.test.ts` asserts `CLI_VERSION` and `program.version()` match `package.json` — don't hardcode version strings anywhere.
- **npm refuses to overwrite published versions.** If publish fails after `npm version` has already bumped, either `npm unpublish` within 72 hours or bump again (e.g., 0.4.1 → 0.4.2).

## Shell

Use PowerShell for all shell commands.
