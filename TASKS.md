# bbdata TASKS — post-audit backlog

Source: `../ai-baseball-data-analyst/course-audit.md` (2026-04-13). CLI-side items that close gaps between what the Baseball AI Community course promises and what `bbdata` actually does.

**Important trade-off:** every pending item below is an *alternative* to a course-content fix in the audit. If the course rewrites Module 04's Visualization Template Library deliverable (~4h edit), most of Priority 2 becomes optional. Decide on the course vs. CLI direction first, then pick from this list.

---

## Status at a glance

| ID   | Title                                        | Status   | Priority | Effort    | Version / Notes                                                         |
|------|----------------------------------------------|----------|----------|-----------|-------------------------------------------------------------------------|
| P1.1 | `--format png` on `viz`                      | Shipped  | P1       | —         | v0.7.0 — `src/commands/viz.ts:28`, `src/viz/rasterize.ts`               |
| P1.2 | viz-type aliases (option b)                  | Shipped  | P1       | —         | v0.7.0 — `src/viz/charts/index.ts:23–28`                                |
| P1.3 | `--window N` on `rolling`                    | Shipped  | P1       | —         | v0.7.0 — `src/commands/viz.ts:167`, `src/viz/charts/rolling.ts`         |
| P3.1 | `--format pdf`                               | Shipped  | P3       | —         | v0.7.1 — `src/viz/render.ts` `specToPdf()`, commit `c504e0c`            |
| P3.2 | `--format html`                              | Shipped  | P3       | —         | v0.7.0 — `src/viz/render.ts` `specToHtml()`                             |
| P3.3 | `--dpi <n>` flag                             | Shipped  | P3       | —         | v0.7.0 — `src/commands/viz.ts:165`                                      |
| P3.4 | `--data <path>` (JSON + CSV input)           | Shipped  | P3       | —         | v0.7.2 — `src/utils/data-input.ts`, `src/adapters/savant-csv.ts`        |
| P4.1 | query-template docs                          | Shipped  | P4       | —         | v0.7.0 — `README.md:56–64`                                              |
| P4.2 | `draft-board-card-pitcher` doc               | Shipped  | P4       | —         | v0.7.0 — `README.md:95`                                                 |
| P4.3 | `--audience` harmonization                   | Shipped  | P4       | —         | v0.7.0 — `src/commands/report.ts:85–106`                                |
| P2.1 | `pitching-heatmap` viz type                  | Pending  | P2       | L (4–6h)  | Highest student-visibility of P2 set — leads Module 04 Lesson 3         |
| P2.2 | `hitting-barrel` viz type                    | Pending  | P2       | L (4–6h)  | EV vs LA scatter with barrel/hard-hit overlay                           |
| P2.3 | `percentile-chart` viz type                  | Pending  | P2       | L (~6h)   | Needs new `player-percentiles` query template                           |
| P2.4 | `comparison-table` viz type                  | Pending  | P2       | L (4–6h)  | SVG/PNG color-coded — distinct from existing markdown leaderboard       |
| P2.5 | `team-dashboard` viz type                    | Pending  | P2       | XL (1–2d) | Also adds `--team`, `--unit pitching\|hitting` flags                    |
| P2.6 | `release-point` chart variant                | Pending  | P2       | M (~3h)   | `pitcher-raw-pitches` already has `release_pos_x/z`                     |
| P4.4 | Fix `/build-model equivalent` fake query IDs | Decide   | P4       | S–M       | 3 options below; leaning (c) remove callouts                            |
| P4.5 | Friendly error for minimal-field stdin JSON  | Shipped  | P4       | —         | v0.9.0 — 2026-04-19 — new `assertFields()` helper in `src/utils/validate-records.ts`; applied to `pitcher-arsenal.transform()` with the fields it dereferences; error names every missing field + points at the PitchData schema |

**All P2.x items are conditional.** If Aaron rewrites `Modules/04/Deliverables/Visualization Template Library.md` (audit recommendation #1), skip the entire P2 section.

---

## Shipped in v0.9.0

Codex senior-eng review cleanup + one course-audit follow-up. **Breaking**
for library consumers that imported `getStdinAdapter()` / relied on
`loadDataFile()` being void (R1.3). CLI surface (flags, args, output) is
unchanged. See `CHANGELOG.md` for the full migration guide and
`TEST_PLAN.md` v0.9.0 section for live smoke coverage.

- **R1.1 — caching actually works.** `fetchWithCache(adapter, query, policy)` at `src/cache/fetch-with-cache.ts`; `query()` threads a per-invocation `CachePolicy` derived from `config.cache.enabled && options.cache !== false` + `config.cache.maxAgeDays`. `--no-cache` and the config toggles now behave as documented (they were silent no-ops before). Tests: `test/cache/fetch-with-cache.test.ts`.
- **R1.2 — `report --data` no longer hits the network.** Closed as a side effect of R1.3 — `--stdin` and `--data` now populate the same per-invocation adapter, threaded through `generateReportGraphs({ stdinAdapter })` into embedded viz.
- **R1.3 — per-invocation stdin isolation (breaking for lib).** Module-singleton `stdinAdapter` removed from `src/adapters/index.ts`; `createStdinAdapter()` factory + `resolveAdapters(preferred, overrides?)` override map take its place. `loadDataFile(path)` now returns the new adapter instead of mutating global state. Threaded through `query` / `report` / `viz` / `generateReportGraphs`.
- **R2.1 — `sources.*.enabled` config is honored.** `isSourceEnabled` / `sourceConfigKey` in `src/config/config.ts` with a `SOURCE_CONFIG_KEYS` kebab↔camel map; `query()` filters `template.preferredSources` through it and fails loudly when `--source` names a disabled source. Tests: `test/config/sources.test.ts`.
- **R4.1 — lint wired into publish gate.** `eslint@^10` + `@eslint/js` + `typescript-eslint@^8` added; new flat-config `eslint.config.js`; `npm run lint` now part of `prepublishOnly`. 18 pre-existing issues cleaned during wiring.
- **P4.5 — friendly `pitcher-arsenal` stdin error.** New `assertFields()` helper in `src/utils/validate-records.ts` applied at `pitcher-arsenal.transform()`; missing-field errors now name every absent field and point at the `PitchData` schema instead of `TypeError: cannot read properties of undefined`.

Test-infra follow-up this release also included pinning the vitest worker to `TZ=UTC` via `test/setup-tz.ts` so the rolling-chart snapshot is stable on non-UTC developer machines.

---

## Shipped in v0.8.0

Package rename only — **no P-items closed**. `bbdata-cli` → `bbdata` on
npm. Binary name unchanged. See `CHANGELOG.md` for the migration
instructions and `RENAME_PLAN.md` for the full 5-phase plan.

- **Phase 1 (rename source edits):** commit `e5e1f1d` — `package.json` name, `src/utils/version.ts` walk-up sentinel, README/badges/import example, `CHANGELOG.md` 0.8.0 section.
- **Phase 2 (publish):** commit `166478c`, tag `v0.8.0`, published 2026-04-14. Verified: `npm view bbdata version` → `0.8.0`; fresh-project `import { query, report, viz } from 'bbdata'` → all three `function`.
- **Phase 3** (scout-app migration), **phase 4** (course + skill docs sweep), **phase 5** (`npm deprecate bbdata-cli`) are tracked in `RENAME_PLAN.md` and deferred to separate sessions.

---

## Pending — details

### P2.1 — `pitching-heatmap`
- **What:** KDE density plot of pitch locations in the zone.
- **Data:** `pitcher-raw-pitches` supplies `plate_x`, `plate_z` per pitch.
- **Files:** `src/viz/charts/pitching-heatmap.ts` (new), `src/viz/charts/index.ts`, `test/fixtures/viz/`

### P2.2 — `hitting-barrel`
- **What:** Exit velocity vs. launch angle scatter with barrel/hard-hit zones overlaid.
- **Data:** `hitter-raw-bip` supplies `launch_speed`, `launch_angle`.
- **Files:** `src/viz/charts/hitting-barrel.ts` (new), `src/viz/charts/index.ts`

### P2.3 — `percentile-chart`
- **What:** Savant-style horizontal percentile bars (e.g., xwOBA 92nd percentile).
- **Data:** needs a new `player-percentiles` query template upstream, or can derive from FanGraphs season data.
- **Note:** effort includes both new query template and new chart.

### P2.4 — `comparison-table`
- **What:** Color-coded multi-player stat comparison table, rendered as SVG/PNG (not the existing `leaderboard-comparison` markdown output).

### P2.5 — `team-dashboard`
- **What:** Multi-chart composite for a team. Course uses `--team NYY --unit pitching|hitting`.
- **Blocks:** also introduces `--unit pitching|hitting` flag and `--team` on viz command.

### P2.6 — `release-point`
- **What:** Release point consistency scatter. Referenced in Module 04 Lesson 3:95.
- **Data:** `pitcher-raw-pitches` has `release_pos_x`, `release_pos_z`.

### P4.4 — `/build-model equivalent` fake query names — **Decide**
- **Why:** `ai-baseball-data-analyst/Modules/05 - Code & Model Building/Deliverables/Model Template Library.md` has 8 `/build-model equivalent` callouts (lines 89, 152, 216, 279, 358, 423, 490) with `bbdata-cli query <name>` invocations that reference 6 template IDs not present in `src/templates/queries/`: `pitcher-stats`, `statcast-pitches`, `hitter-stats`, `hitter-splits`, `pitcher-game-logs`, `hitter-statcast`. Verified 2026-04-14 via direct grep over every `id: '...'` line in the queries registry. Students copying these bash lines hit "template not found". The course shipped with the wrong names; bbdata didn't drift. Analogous to P1.2 for viz types.
- **Options:**
  - **(a) Course-side rewrite** — remap each fake name to the closest real template (e.g., `hitter-stats` → `hitter-season-profile`; `statcast-pitches` → `pitcher-raw-pitches`; `hitter-splits` → `hitter-handedness-splits`; `pitcher-game-logs` → `pitcher-recent-form`). Zero CLI work, ~30min course edit.
  - **(b) bbdata alias layer** — register the 6 fake names as aliases for closest-fitting real templates. Preserves course content verbatim. Some mappings (`hitter-stats`) are ambiguous enough that any alias choice will confuse half the use cases. Effort M (~1h).
  - **(c) Drop the callouts entirely** — `/build-model` is flagged in course audit Section A as "Shipped (by design)" — it generates Python / prompts, not CLI calls. So the "CLI equivalent" callouts may not be load-bearing; removing them is cleaner than a rewrite or alias layer.
- **Recommendation:** (c) if `/build-model` is Python-generation rather than CLI-passthrough. (a) is the fallback if the callouts are load-bearing for some student workflow.
- **Files:** (a/c) `ai-baseball-data-analyst/Modules/05 - Code & Model Building/Deliverables/Model Template Library.md`; (b) new alias layer in `src/templates/queries/index.ts`.

### P4.5 — Friendly error for minimal-field stdin JSON — **Shipped 2026-04-19**

**Issue (resolved):** `pitcher-arsenal.transform()` dereferenced `pitch.description.includes(...)` on every record. Hand-authored stdin / `--data` fixtures without the full Savant field set crashed with `TypeError: Cannot read properties of undefined (reading 'includes')`, pointing the stack trace at the template rather than the missing input field. Real Savant exports always include these fields — the bug only surfaced for tutorial / test / minimal payloads.

**What shipped:**
- **New helper** `src/utils/validate-records.ts` — `assertFields(records, requiredFields, templateId)`. Checks the first record (payloads are homogeneous in practice), collects *every* missing field into one message, and points at `src/adapters/types.ts` for the full PitchData / PlayerStats contract.
- **Applied to `pitcher-arsenal.ts`** with its actual dereferenced fields: `description`, `release_speed`, `release_spin_rate`, `pfx_x`, `pfx_z`. (The existing `if (!pitch.pitch_type) continue` soft-skip is preserved for heterogeneous inputs — only the fields the template would otherwise silently NaN-out on or crash on are required.)
- **Tests:** two new cases in `test/templates/pitcher-arsenal.test.ts` — one verifies the error names the template + the specific missing field, the other verifies every missing field appears in one message (so a user fixing a sparse fixture edits all of them in one pass instead of bisecting).

**Chose (b) over (a):** per the original triage. Silent degradation ("Unknown" rows, NaN-filled stats) is worse than a fail-fast error with a schema pointer — analyst-user payloads should round-trip cleanly or die explicitly, not return dashboards full of dashes.

**Other templates with the same pattern:** `src/templates/queries/` has 9 other files that use `.includes()` on optional-in-stdin fields (`pitcher-velocity-trend`, `trend-rolling-average`, `hitter-handedness-splits`, `hitter-hot-cold-zones`, `hitter-vs-pitch-type`, `leaderboard-comparison`, `leaderboard-custom`, `matchup-pitcher-vs-hitter`, `pitcher-handedness-splits`). `assertFields` is ready for them — adoption is a drop-in when they next get touched or when a student hits the same crash. Out of scope for P4.5 since the original triage named only pitcher-arsenal.

---

## Non-bbdata items from the audit (reference only)

All course-side fixes — no bbdata work:

- Rewrite `Modules/04/Deliverables/Visualization Template Library.md`
- Fix `/viz --type compare|dashboard|heatmap|barrel|percentile` across Module 04 Lesson/Outline/Deliverables
- Correct survey figures: "83 analysts" → 67 in `Project Dashboard.md:46`; Coach 16 → 11 at `:50`; "68" → "67" across Module READMEs
- Rewrite `.claude/skills/viz/SKILL.md` "12 templates" → "5 CLI + 7 Python prompts"
- Add `audience` reference table to Module 04 Lesson 4
- Rewrite or remove the 8 `/build-model equivalent` callouts (see P4.4 for options)

---

## From Codex senior-eng review (2026-04-19)

Source: Codex CLI rescue, job `task-mo52xq64-55apez`, session `019da353-7cd8-7042-8f2d-9bc2ebfc3926`. These are correctness / hygiene items distinct from the course-audit backlog above. Numbering continues the Px scheme.

### Status at a glance

| ID   | Title                                                 | Status   | Priority | Effort   | Notes                                                        |
|------|-------------------------------------------------------|----------|----------|----------|--------------------------------------------------------------|
| R1.1 | Caching is unimplemented despite public contract      | Shipped  | P1       | —        | v0.9.0 — 2026-04-19 — new `fetchWithCache(adapter, query, policy)` wrapper in `src/cache/fetch-with-cache.ts`; `query()` builds a per-invocation `CachePolicy` from `config.cache.enabled && !options.cache===false` and `config.cache.maxAgeDays`; wrapper routes through `getCached` / `setCache`, honors `--no-cache`, and skips `stdin` |
| R1.2 | `report --data` still triggers network fetches        | Shipped  | P1       | —        | v0.9.0 — 2026-04-19 — resolved as side effect of R1.3; both `--stdin` and `--data` populate the same `stdinAdapter`, threaded through `generateReportGraphs` |
| R1.3 | Global stdin adapter leaks state across calls         | Shipped  | P1       | —        | v0.9.0 — 2026-04-19 — singleton removed, `resolveAdapters(overrides)` + `createStdinAdapter()` per invocation; `loadDataFile` now returns an adapter; threaded through `query` / `report` / `viz` / `generateReportGraphs` |
| R2.1 | Source enable/disable config is ignored               | Shipped  | P2       | —        | v0.9.0 — 2026-04-19 — `isSourceEnabled` / `sourceConfigKey` helpers in `src/config/config.ts`, kebab↔camel map in `SOURCE_CONFIG_KEYS`; `query()` filters `template.preferredSources` through config + errors loudly when `--source` names a disabled source |
| R4.1 | Lint/release hygiene broken (eslint missing)          | Shipped  | P4       | —        | v0.9.0 — 2026-04-19 — added `eslint@^10` + `@eslint/js` + `typescript-eslint@^8` to `devDependencies`; new flat-config `eslint.config.js`; `lint` wired into `prepublishOnly`; 18 surfaced issues cleaned (unused imports, adapter-interface args prefixed `_`, `require()` → import in cache, escape / `cause` cleanup) |
| R5.0 | Strategic: adopt `ExecutionContext` per command       | Decide   | —        | XL       | Routes `query` / `report` / `viz` through one context object |

---

### R1.1 — Caching is unimplemented despite public contract — **Shipped 2026-04-19**

**Issue (resolved):** `query()` accepted `bypassCache` but adapters never read or wrote cache, and `src/cache/store.ts`'s `getCached` / `setCache` were dead code. `--no-cache`, `config.cache.enabled`, and `config.cache.maxAgeDays` — all documented in README — were silent no-ops. Every invocation hit upstream fresh.

**What shipped:**
- **New wrapper** `src/cache/fetch-with-cache.ts` — `fetchWithCache(adapter, query, policy: { enabled, maxAgeDays })`. On a hit: returns the cached `AdapterResult` with `cached: true` (no adapter call). On a miss: calls `adapter.fetch(query, { bypassCache: true })` so adapters don't double-cache, then stores the JSON-serialized result. Corrupt cache entries fall through to a fresh fetch. `stdin` is unconditionally skipped — it's a local in-memory path. Failed cache writes are swallowed (non-critical).
- **`src/commands/query.ts`** — builds one `CachePolicy` per invocation (`enabled: config.cache.enabled && options.cache !== false`, `maxAgeDays: config.cache.maxAgeDays`) and routes every adapter call through `fetchWithCache`. Replaces the old direct `adapter.fetch(adapterQuery, { bypassCache: options.cache === false })`.
- **Cache key** reuses the existing `queryHash(source, params)` in `store.ts` (16-char SHA256 prefix of `source:sorted(params)`), so on-disk entries from prior experimentation remain schema-compatible. Fallback chain still works — one cache slot per (adapter, query).

**Why at `query.ts`, not adapter-level:** adapter `fetch()` stays pure (network in, typed data out) — the cache is a per-invocation concern carried by the caller. This matches the R1.3 `overrides` pattern and sets up R5.0's `ExecutionContext` cleanly.

**Tests (16 new, 251 / 251 total green):**
- `test/cache/fetch-with-cache.test.ts` — 13 wrapper tests covering cold miss + write, warm hit + `cached: true`, `fetchedAt` preservation, corrupt JSON fallthrough, bypass policy (skip both read and write), `stdin` exclusion, error propagation without stale cache writes, and tolerance of a failing `setCache`.
- `test/commands/query.test.ts` — 3 integration tests: cold-miss wiring, warm-hit short-circuit (adapter.fetch not called), and `--no-cache` bypass.

**Semver impact:** not a breaking change per the public API — the CLI flags and programmatic signatures are unchanged. But "cache is a no-op" → "cache actually works" is a semantically large behavior change, so it gets the 0.9.0 minor bump (already planned).

**Future groundwork:** the `CachePolicy` object is the natural next parameter to gather into an R5.0 `ExecutionContext { adapters, cache, config, sourcePolicy }` alongside the `overrides` map from R1.3 and `isSourceEnabled` from R2.1.

### R1.2 — `report --data` can still trigger network fetches for embedded graphs — **Shipped 2026-04-19 (via R1.3)**

**Issue (resolved):** Report query sections used the stdin/data path, but `generateReportGraphs` only forwarded `stdin`, not `data`. So `report --data foo.json` still fired network calls inside embedded viz.

**How R1.3 closed it:** The R1.3 refactor unified both `--stdin` and `--data` onto a single per-invocation `stdinAdapter` instance — populated by either path in `report()` and threaded through `generateReportGraphs({ stdinAdapter })`. Inside `embed.ts`, `viz()` is invoked with `{ source: 'stdin', stdinAdapter }` whenever the parent loaded either flag, so the embedded graph's fetch loop resolves to the same in-memory adapter rather than the network adapters. Verified by grep: the only stdin/data discriminator left in `src/viz/` is `opts.stdinAdapter`, which is populated identically for either option.

**Codex had flagged this separately** with a narrower suggested fix ("force `source: 'stdin'` when either is set"). Fixing the underlying pattern (R1.3) turned the symptom into a non-issue without needing the narrower patch — a reminder that R5.0's strategic refactor direction is well-aimed.

**TEST_PLAN coverage:** v0.9.0 row RP.2 (`report --data` end-to-end with embedded graphs) validates this scenario.

### R1.3 — Global mutable stdin adapter introduces cross-call state leakage — **Shipped 2026-04-19**

**Issue (resolved):** The singleton `stdinAdapter` stored its mutable payload and was reused across calls for the process lifetime, letting long-lived programmatic consumers (scout-app via `src/lib/prefetch.ts`, course tooling) silently read stale prior input when using `source: 'stdin'`.

**What shipped:**
- `src/adapters/index.ts` — removed the module-scope `stdinAdapter` singleton; removed `'stdin'` from the static adapter record; replaced `getStdinAdapter()` with a `createStdinAdapter()` factory; `resolveAdapters(preferred, overrides?)` now accepts an override map so per-call stdin instances flow through the same resolution path as the network adapters.
- `src/utils/data-input.ts` — `loadDataFile(path)` now **constructs and returns** a fresh `StdinAdapter` instead of mutating the singleton.
- `src/commands/query.ts` — added `stdinAdapter?: StdinAdapter` to `QueryOptions` (internal plumbing; skills / agents calling `query()` directly typically pass `stdin` or `data` instead). `query()` builds a per-invocation adapter and passes it into `resolveAdapters`.
- `src/commands/report.ts` / `src/commands/viz.ts` — each entry point constructs one adapter and threads it through every sub-`runQuery(...)` call + `generateReportGraphs(...)`. No sibling calls share state via the module; all share the explicit instance.
- `src/viz/embed.ts` — `generateReportGraphs` now accepts `{ stdinAdapter? }` and forwards it to `viz()`.
- `src/viz/types.ts` — `VizOptions.stdinAdapter?` mirrors the `query` option for symmetry.
- `test/utils/data-input.test.ts` — updated to use the new `loadDataFile` return value + added a regression test that asserts two back-to-back calls return independent adapter instances (the exact scenario the old singleton broke).

**Verification:**
- `npx tsc --noEmit` — clean.
- `npx vitest run test/utils/data-input.test.ts` — 8 / 8 pass including the new no-leak regression.
- Full suite: 228 / 229 (1 pre-existing Vega snapshot drift, present on `main` before this change — confirmed via `git stash`; tracked separately).

**Knock-on benefit:** scout-app's `src/lib/prefetch.ts` path benefits for free once it upgrades to the new bbdata version — concurrent requests from the same warm Vercel instance can no longer share stdin payload via the singleton.

**Next-step hint for R5.0 (strategic ExecutionContext):** the overrides map on `resolveAdapters` is a natural inflection point — generalize `{ stdin: adapter }` into a full per-invocation `ExecutionContext { adapters, cache, config, sourcePolicy }` when R1.1 (caching) lands.

### R2.1 — Source enable/disable config is defined but ignored — **Shipped 2026-04-19**

**Issue (resolved):** The config schema and README documented per-source toggles (`sources.savant.enabled`, `sources.mlbStatsApi.enabled`, etc.), but `query()` never consulted them before calling `resolveAdapters()`. Config changes were silently no-ops.

**What shipped:**
- `src/config/config.ts` — added a single-source-of-truth mapping table `SOURCE_CONFIG_KEYS` that bridges the kebab-case `DataSource` values (`mlb-stats-api`, `baseball-reference`) to the camelCase config keys (`mlbStatsApi`, `baseballReference`). Exported `isSourceEnabled(config, source)` and `sourceConfigKey(source)` helpers.
- `src/commands/query.ts` — filters `template.preferredSources` through `isSourceEnabled` before `resolveAdapters`. Two distinct error paths:
  - **Explicit `--source <X>` names a disabled source:** throws an actionable error pointing at `~/.bbdata/config.json → sources.<camelKey>.enabled = true`.
  - **Template default sources are all disabled:** throws a template-scoped error listing the disabled sources and suggesting `--source`.
- `stdin` bypasses the enable check — it's a local data path, not a configurable network source.

**Verification:**
- New unit test suite `test/config/sources.test.ts` (6 tests, all green): default enable-state, kebab↔camel mapping, `stdin` always allowed, toggle-flip behavior.
- `test/commands/query.test.ts` mock updated to expose the new helpers (they default to `true` so existing fallback-chain tests aren't affected).
- Full suite: 235 / 235 green.

### R4.1 — Lint / release hygiene broken — **Shipped 2026-04-19**

**Issue (resolved):** `lint` script existed (`package.json:28`) but eslint was not in `devDependencies`, and `prepublishOnly` omitted lint — so `npm run lint` failed on any clean install and style/safety regressions could ship unchecked.

**What shipped:**
- `devDependencies` gained `eslint@^10`, `@eslint/js@^10`, `typescript-eslint@^8`.
- New `eslint.config.js` — flat-config, `js.configs.recommended` + `tseslint.configs.recommended`, `_`-prefixed argsIgnorePattern, `no-explicit-any` off (the codebase intentionally uses `any` at a few adapter boundaries), empty catch allowed.
- `prepublishOnly` chain now: `build && lint && typecheck && test`.
- **Incidental cleanups** surfaced by the first clean lint pass (all 18 fixed, zero errors on `main`):
  - Unused imports removed: `parse` in `src/adapters/fangraphs.ts:1`; `FormattedOutput` in `src/commands/query.ts:5`; `gradeColor` in `src/commands/report.ts:8`; `QueryTemplateParams` in `src/templates/queries/pitcher-arsenal.ts:1`; `pitchTypeName` in `src/templates/queries/pitcher-velocity-trend.ts:3`; `DataSource, AdapterQuery` in `src/templates/reports/registry.ts:1`.
  - `_`-prefixed interface args (intentional per-`DataAdapter`-contract unused args): `supports(_query)` and `fetch(..., _options)` on FanGraphs / MLB Stats API / Savant adapters; `transform(data, _params)` in `trend-year-over-year`.
  - `require('node:fs')` inside `src/cache/store.ts:saveDb` hoisted to the top-level import.
  - `const cmd =` dropped from `registerQueryCommand` (Commander chain used only for side effect).
  - `const result =` dropped in `test/commands/query.test.ts:125` (test asserts adapter calls, not the return value).
  - `src/viz/charts/rolling.ts:20` — unnecessary `\-` escape in character class removed.
  - `src/adapters/stdin.ts:57` — rethrown parse error now forwards `{ cause: error }` so callers keep the underlying stack.

**Verification:** `npm run lint` → clean. `npm run typecheck` → clean. `npm test` → 235 / 235 green. `npm run prepublishOnly` end-to-end → green.

### R5.0 — Strategic: `ExecutionContext` per command invocation — **Decide**

**What:** Route `query`, `report`, and `viz` through a single `ExecutionContext` object that carries config, source policy, cache policy, input payload, and adapters for the life of the invocation.

**Why:** R1.1 (caching), R1.3 (stdin state), and R2.1 (source toggles) are all symptoms of the same pattern — per-concern plumbing duplicated across commands, drifting out of sync. One context object + consistent wiring fixes all three in one refactor and prevents future divergence.

**Risk:** touches every command entry point. Best landed alongside R1.x fixes, not before. Could also be deferred indefinitely if R1.x are fixed locally and the duplication stays manageable.

**Files (exploratory):** `src/commands/query.ts`, `src/commands/report.ts`, `src/commands/viz.ts`, `src/index.ts`, new `src/context/execution.ts`.

---

## Suggested sequencing

Phase A (P1.1, P1.2b, P1.3, P3.2, P3.3, P4.1, P4.2, P4.3) shipped in v0.7.0; Phase B (P3.1) in v0.7.1; Phase C (P3.4) in v0.7.2.

Remaining, in rough order:
1. **R1.1, R1.2, R1.3** — correctness bugs from Codex review; R1.1 is the biggest silent-failure and blocks any caching-dependent feature. R1.3 directly affects scout-app's server-side invocation of bbdata via `prefetch.ts`.
2. **R2.1, R4.1** — small hygiene items, can drop in opportunistically.
3. **P2.1** (`pitching-heatmap`) — Module 04 Lesson 3 leads with it, highest student visibility.
4. Remaining P2.x in whatever order survey signal favors.
5. **P4.4** — course-side decision; pick option (c) unless callouts turn out to be load-bearing.
6. **P4.5** — one-hour polish, drop in alongside any stdin-adapter or arsenal-template touch.
7. **R5.0** — consider after R1.x lands and the duplication picture is concrete.

Effort estimates assume one focused half-day per M item.
