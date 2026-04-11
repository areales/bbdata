# Changelog

All notable changes to `bbdata-cli` are documented here. This project follows
[Semantic Versioning](https://semver.org/).

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
