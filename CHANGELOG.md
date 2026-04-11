# Changelog

All notable changes to `bbdata-cli` are documented here. This project follows
[Semantic Versioning](https://semver.org/).

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
