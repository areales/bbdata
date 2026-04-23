# Repository Guidelines

## Project Structure & Module Organization
`bbdata` is a TypeScript ESM CLI. Entry points live in `bin/` and `src/cli.ts`. Core logic is organized under `src/`: `commands/` wires Commander subcommands, `adapters/` fetch external data, `templates/queries/` and `templates/reports/` define reusable outputs, `viz/` renders charts, and `cache/`, `config/`, `formatters/`, and `utils/` hold shared infrastructure. Tests mirror the app by area under `test/`, with reusable fixtures in `test/fixtures/`. Build output goes to `dist/`; helper scripts live in `scripts/`.

## Build, Test, and Development Commands
Use Node.js 18+.

- `npm run dev -- query pitcher-arsenal --player "Name"` runs the CLI directly through `tsx`.
- `npm run build` bundles the package with `tsup` into `dist/`.
- `npm test` runs the full Vitest suite once.
- `npm run test:watch` starts Vitest watch mode for local iteration.
- `npm run lint` checks `src/`, `bin/`, and `test/` with ESLint.
- `npm run lint:partials` validates Handlebars partial usage.
- `npm run typecheck` runs `tsc --noEmit`.
- `npx vitest run test/commands/query.test.ts` is the fastest way to target one file.

## Coding Style & Naming Conventions
Use 2-space indentation and keep modules ESM-only. Import local TypeScript modules with `.js` extensions, matching the current source. Prefer small, focused files and keep command logic thin by pushing reusable work into `src/` helpers. File names are lowercase kebab-case such as `pitcher-rolling-trend.ts`; tests end in `.test.ts`. Follow ESLint defaults plus the repo rules: unused variables must be prefixed with `_`, and avoid writing decorative logs to stdout.

## Testing Guidelines
Vitest is the test runner; `test/setup-tz.ts` standardizes timezone-sensitive behavior. Add tests beside the matching area (`test/adapters/`, `test/commands/`, `test/templates/`, `test/viz/`, etc.) and use fixtures for network-shaped payloads instead of live calls. Any change to a template, CLI flag, formatter, or chart should ship with regression coverage.

## Commit & Pull Request Guidelines
Git history follows Conventional Commit style, usually with scopes: `feat(viz): ...`, `fix(viz): ...`, `docs(tasks): ...`. Keep subjects imperative and concise; release commits may remain plain versions such as `0.10.0`. PRs should describe the user-visible CLI or API impact, list validation run (`npm run lint`, `npm test`, `npm run typecheck`), and note any docs updates. If you change public templates, flags, or output contracts, also update `README.md`, `CHANGELOG.md`, and `TASKS.md` in the same branch.
