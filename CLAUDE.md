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

## Shell

Use PowerShell for all shell commands.
