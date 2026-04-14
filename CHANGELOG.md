# Changelog

All notable changes to `bbdata-cli` are documented here. This project follows
[Semantic Versioning](https://semver.org/).

## 0.7.0 — 2026-04-14

Phase A of the post-audit TASKS.md backlog. Closes the gap between what the
Baseball AI Community course's Module 04 deliverables promise and what `bbdata`
ships on the output-format, rolling-window, chart-alias, and audience fronts.
No breaking changes to existing CLI callers — every new behavior is opt-in via
a new flag or an alias.

### Added

- **P1.1 — `--format png` on `viz`.** `@resvg/resvg-js` promoted from
  `devDependencies` to `dependencies`; the rasterizer helper moved from
  `test/helpers/rasterize.ts` to `src/viz/rasterize.ts` (both production
  scripts that already used it — `render-fixtures.ts`, `extract-report-assets.ts`
  — updated to the new import path). The `viz` command now branches on
  `--format` at `src/commands/viz.ts` and writes a PNG binary when requested.
  Binary output to a TTY is refused with a hint to use `--output` or a pipe.
- **P3.2 — `--format html`.** New `specToHtml()` in `src/viz/render.ts` wraps
  the rendered SVG in a minimal standalone HTML document and embeds the source
  Vega-Lite spec as a `<script type="application/json" id="bbdata-spec">` block
  so downstream tooling can re-extract it without re-running the CLI. Tags
  inside the spec are escaped (`</script>` → `\u003c/script>`) so an
  adversarial spec can't break out of the script block.
- **P3.3 — `--dpi <n>` flag.** Only meaningful for raster output. Computes the
  raster width as `round(chartWidth × dpi / 96)`, so `--dpi 300` on an 800px
  chart produces a 2500px PNG. Falls back to 2× chart width when omitted.
- **P1.3 — `--window <n>` flag on `viz rolling`.** Threads through
  `VizOptions` → `QueryOptions` → `QueryTemplateParams` → the
  `trend-rolling-average` template's `transform()`. The template now reads
  `params.window ?? 15` at the previously hard-coded line (registry.ts
  carries a new optional `window` field to keep the type honest). The course's
  `--window 5` example on `Modules/04/Deliverables/Visualization Template
  Library.md:466` now works end-to-end.
- **P1.2(b) — Chart-type aliases.** `src/viz/charts/index.ts` adds a unidirectional
  alias map: `pitching-movement → movement`, `hitting-spray → spray`,
  `hitting-zones → zone`, `trend-rolling → rolling`. Resolved via new
  `resolveChartType()` before the registry lookup. `listChartAliases()`
  exposes the map so the CLI help text and `viz` sans-args listing show
  both canonical and aliased names. Chose this over the course rewrite
  because it unblocks existing course commands without touching the course.
- **`src/viz/rasterize.ts`** (promoted from `test/helpers/`). Same surface,
  same defaults (`width: 1600`, `background: '#ffffff'`, system fonts
  loaded). Tuned for the assistant's PNG-via-Read-tool workflow.

### Changed

- **P4.3 — `--audience` enum harmonized across `viz` and `report`.** The two
  commands used disjoint vocabularies (`coach|gm|scout|analyst` for report;
  `coach|analyst|frontoffice|presentation` for viz). New
  `resolveReportAudience()` in `src/commands/report.ts` accepts the superset
  at the CLI boundary and normalizes `presentation → analyst`,
  `frontoffice → gm` before the template resolution. `ReportOptions.audience`
  widened to `Audience | VizAudience | string` with a safe fallback to
  `analyst` for typos. The report-template `audiences: Audience[]` arrays
  are untouched — the harmonization is a CLI-boundary normalizer, not a type
  widening, to keep the blast radius small.
- **`viz` command help text** rewritten to surface chart aliases and the new
  `--format`, `--dpi`, `--window` flags. `bbdata viz` with no type argument
  now prints both the canonical chart list and the alias map.

### Developer notes

- **No breaking changes.** Every new flag is optional with a back-compatible
  default. Programmatic callers of `viz()` / `report()` that don't pass the
  new options see identical behavior to 0.6.1.
- **Test coverage.** 6 new cases in `test/commands/viz.test.ts` (PNG branch,
  HTML branch, DPI scaling, `--window` thread-through, alias resolution,
  unsupported-format rejection) + 3 new cases in `test/viz/render.test.ts`
  for `specToHtml` + a new `test/viz/rasterize.test.ts` smoke suite. `npm test`
  green at 213 tests (was 207).
- **`test/helpers/rasterize.ts` deleted.** No test imports it; the two
  production scripts that did are updated to `src/viz/rasterize.js`.
- **package.json dependency move** is the one change that touches the
  release-sensitive surface. Run `npm install` once before `npm version`
  to re-sort `package-lock.json` — `npm version` itself won't reorder deps.

## 0.4.0 — 2026-04-10

### Added

- **`pro-hitter-eval` now populates Splits Analysis and Rolling Trend sections.** Previously two `*To be populated*` placeholder stubs, the template now renders (a) a handedness splits table (vs LHP / vs RHP) and (b) a five-panel rolling performance chart (AVG, SLG, K%, Avg EV, Hard Hit %) embedded alongside the existing Trend Analysis table. Both sections degrade gracefully via `{{#if}}{{else}}` when source data is empty. Validated end-to-end against Aaron Judge 2025 (elite RH full season), Gerrit Cole 2025 (pitcher regression check), and Roman Anthony 2025 (LH rookie mid-season callup).
- **New query template `hitter-handedness-splits`** (`src/templates/queries/hitter-handedness-splits.ts`). Filters Statcast batting rows by `p_throws` (pitcher handedness — *not* `stand`, which is the batter's side), labels each row vs LHP / vs RHP, and returns `stat_type: 'batting'`. Self-registers via side-effect import. 7 unit tests including an explicit assertion that the filter uses `p_throws` and not `stand`, since the two columns look interchangeable at a glance but quietly return the wrong handedness's splits if swapped.
- **`rollingChart` slot on `pro-hitter-eval`.** `src/viz/embed.ts` now routes `trend-rolling-average` query output through the existing `rollingBuilder` into a new slot consumed by the template.
- **`scripts/extract-report-assets.ts`** — reusable preview script. Takes a markdown file from `.reports/`, extracts inline `<svg>` blocks, rasterizes each via the same `rasterizeSvg` helper used by `render-fixtures.ts`, and writes `<slug>-chart-<N>.png` adjacent to the source. Closes the live-data feedback loop the way `viz:fixtures` closes the synthetic-data loop. Usage: `npx tsx scripts/extract-report-assets.ts <file.md>`.

### Changed

- **`pro-hitter-eval` data requirements grew from 3 queries to 5.** The template now additionally fetches `hitter-handedness-splits` and `trend-rolling-average`. Both new queries are marked `required: false` so a failure in either degrades gracefully rather than blocking the whole report.
- **`test/templates/registry.test.ts`** — expected template count bumped from 15 to 16 to account for the new `hitter-handedness-splits` registration.

### Developer notes

- **No breaking changes** to CLI surface, programmatic API, or output format.
- **Consumers of `pro-hitter-eval` (notably `scout-app`)** will see richer output automatically — no code changes required on their side. `scout-app/src/lib/bbdata.ts` spawns a fresh Node subprocess per request via `execFile`, so the new version takes effect as soon as `npm install bbdata-cli@0.4.0` is run there; no dev-server restart needed.

### Release checklist (for maintainers)

1. `npm run viz:fixtures` — regenerate fixture PNGs, visually sanity-check each chart builder
2. `npx tsx scripts/extract-report-assets.ts pro-hitter-eval_judge_2025.md` — visual verification on a live report
3. `npm run build && npm run typecheck && npm test` — all clean (also runs automatically via `prepublishOnly`)
4. Update this file with the release date
5. `npm publish`
6. `git tag v0.4.0 && git push --tags`
7. In `scout-app`: `npm install bbdata-cli@0.4.0`, then visual verification at `localhost:3000/chat`

## 0.3.0 — 2026-04-10

### Fixed

- **Zone chart cell labels are now readable.** The text-halo rule (`paint-order: stroke`) was correctly specified in the Vega-Lite spec, but Vega's Node SVG serializer silently dropped the attribute, leaving numeric xwOBA labels rendered as ghosted near-invisible text over dark-red MVP-tier cells. `specToSvg()` now post-processes the output to inject `paint-order="stroke"` on any text element that has both `fill` and `stroke`. All charts rendered via bbdata — including `bbdata report pro-hitter-eval` embeds consumed by `scout-app` — inherit the fix automatically.

### Added

- **Visual test harness.** `npm run viz:fixtures` renders each of the four chart types (movement, spray, zone, rolling) from fixture JSON into both `.svg` and `.png` files under `.reports/fixtures/`, using `@resvg/resvg-js` as the rasterizer. This closes the feedback loop for chart development — you (or the assistant) can inspect the PNGs directly instead of regenerating and previewing markdown.
- **Snapshot + structural tests** for all four chart builders (`test/viz/snapshots.test.ts`). In addition to SVG snapshots (normalized for stable diffing), explicit assertions cover:
  - Zone cell labels carry `paint-order="stroke"` (regression test for the bug above)
  - Zone cell label text content matches fixture xwOBA values to 3 decimals (accuracy check)
  - Zone color scale uses `redyellowblue` reverse, domain `[0.2, 0.5]`, clamp enabled
  - Rolling chart uses faceted small multiples with `resolve.scale.y === 'independent'` (prevents anyone from reverting to shared-axis which would squash mixed-unit metrics)
  - All charts: title, axis labels, non-zero viewBox
- **New fixture** `test/fixtures/viz/zone-grid.sample.json` — 9-cell Judge-ish grid spanning ~.190 to ~.705 so snapshots exercise both the clamp endpoints and the readable mid-range.
- **`ensureTextPaintOrder()`** helper exported from `src/viz/render.ts` for advanced consumers who want to apply the same post-process to externally-serialized Vega output.
- **`prepublishOnly` hook** runs `build`, `typecheck`, and `test` before any `npm publish` attempt. Lint is intentionally skipped — the existing `lint` script has no ESLint config at the repo root and errors out on a clean checkout, which is a pre-existing issue unrelated to this release and should be fixed separately.

### Developer notes

- `@resvg/resvg-js` is a devDependency only — no change to the published runtime surface of `bbdata-cli`. If shipping `--format png` becomes useful later, the rasterizer helper at `test/helpers/rasterize.ts` can be promoted to `src/viz/`.
- No breaking changes to CLI, programmatic API, or output format.

### Release checklist (for maintainers)

1. `npm run viz:fixtures` — regenerate PNGs, visually sanity-check each chart
2. `npm run build && npm run typecheck && npm test` — all clean
3. Update this file with the release date
4. `npm publish`
5. `git tag v0.3.0 && git push --tags`

## 0.2.0

_See git history._

## 0.1.1

_See git history._
