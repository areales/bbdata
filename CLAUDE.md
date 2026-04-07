# bbdata CLI

Baseball data CLI tool for querying stats, generating scouting reports, and building analytics pipelines. Built for both human users and AI agents.

## Architecture

- **Commands** (`src/commands/`): Each command exports both a CLI registration function and a programmatic async function.
- **Adapters** (`src/adapters/`): One adapter per data source, implementing the `DataAdapter` interface. Sources: MLB Stats API (JSON), Baseball Savant (CSV), FanGraphs (JSON API), Baseball Reference (beta).
- **Templates** (`src/templates/`): Query templates define how to fetch and transform data. Report templates use Handlebars (.hbs) for rendering.
- **Formatters** (`src/formatters/`): JSON (default, agent-friendly), table (human), CSV (pipelines), markdown (Obsidian).
- **Cache** (`src/cache/`): SQLite via sql.js (WASM) — optional, gracefully degrades if unavailable.

## Conventions

- ESM modules (`"type": "module"` in package.json)
- All imports use `.js` extension (TypeScript ESM requirement)
- Logger writes decorative output to stderr, data to stdout
- `--format json` output includes `{ data, meta }` envelope

## Shell

Use PowerShell for all shell commands.

## Development

```
npm run dev -- query pitcher-arsenal --player "Name"   # run via tsx
npm run build                                           # build with tsup
npm test                                                # vitest
```
