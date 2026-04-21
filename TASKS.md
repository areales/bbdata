# bbdata TASKS — post-audit backlog

Source: `../ai-baseball-data-analyst/course-audit.md` (2026-04-13). CLI-side items that close gaps between what the Baseball AI Community course promises and what `bbdata` actually does.

**Resolved 2026-04-14:** course-side rewrite shipped (audit recommendation #1). `ai-baseball-data-analyst/Modules/04 .../Deliverables/Visualization Template Library.md` now explicitly marks 8 of 12 templates as AI-prompt-only and adds a canonical-types appendix. Commit `2046dd5` in `ai-baseball-data-analyst`. All P2.x items are cancelled — see the "Cancelled" section below.

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
| P2.1 | `pitching-heatmap` viz type                  | Cancelled | P2      | —         | 2026-04-14 — course rewrite marked template #1 AI-prompt-only           |
| P2.2 | `hitting-barrel` viz type                    | Cancelled | P2      | —         | 2026-04-14 — course rewrite marked template #6 AI-prompt-only           |
| P2.3 | `percentile-chart` viz type                  | Cancelled | P2      | —         | 2026-04-14 — course rewrite marked template #11 AI-prompt-only          |
| P2.4 | `comparison-table` viz type                  | Cancelled | P2      | —         | 2026-04-14 — course rewrite marked template #9 AI-prompt-only           |
| P2.5 | `team-dashboard` viz type                    | Cancelled | P2      | —         | 2026-04-14 — course rewrite marked template #12 AI-prompt-only          |
| P2.6 | `release-point` chart variant                | Cancelled | P2      | —         | 2026-04-14 — course rewrite marked template #4 AI-prompt-only           |
| P4.4 | Fix `/build-model equivalent` fake query IDs | Decide   | P4       | S–M       | 3 options below; leaning (c) remove callouts                            |
| P4.5 | Friendly error for minimal-field stdin JSON  | Shipped  | P4       | —         | v0.9.0 — 2026-04-19 — new `assertFields()` helper in `src/utils/validate-records.ts`; applied to `pitcher-arsenal.transform()` with the fields it dereferences; error names every missing field + points at the PitchData schema |

**P2.x are cancelled, not pending.** The course-side rewrite (2026-04-14) is the resolution the conditional was waiting on. Detail lives in the "Cancelled" section below.

---

## Unreleased

Accumulates items completed after v0.9.0 ship; renamed to `Shipped in vX.Y.Z` on the next `npm version`.

- **Footer partial wiring fix.** `src/templates/reports/partials/footer.hbs` existed with `{{cliVersion}}` but was never registered and no `.hbs` template referenced it — reports rendered without any version line (and without the AI-assistance disclaimer the partial carries). Fixed by registering the partial once at module load in `src/commands/report.ts` and converting all 13 report templates + the `generateFallbackTemplate` fallback to `{{> footer}}`. Regression test at `test/commands/report.test.ts` reads version from `package.json` and asserts it appears in the rendered output, so future refactors can't re-orphan the partial.

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

## Cancelled — course-side rewrite shipped 2026-04-14

P2.1 through P2.6 were alternatives to a course-content fix (audit recommendation #1). On 2026-04-14 the course deliverable was rewritten (`ai-baseball-data-analyst` commit `2046dd5`): 8 of the 12 templates in `Modules/04 .../Deliverables/Visualization Template Library.md` now carry an explicit `> [!info]- AI-prompt only` callout, and a new appendix enumerates the 5 canonical `bbdata viz` chart types (`movement`, `movement-binned`, `spray`, `zone`, `rolling`) plus 4 course aliases. The course-vs-CLI gap is closed on the course side — no CLI work required.

| ID   | Would have shipped              | Course template it maps to           |
|------|---------------------------------|--------------------------------------|
| P2.1 | `pitching-heatmap` viz type     | #1 Pitch Location Heatmap            |
| P2.2 | `hitting-barrel` viz type       | #6 Barrel Chart                      |
| P2.3 | `percentile-chart` viz type     | #11 Percentile Chart                 |
| P2.4 | `comparison-table` viz type     | #9 Player Comparison Table           |
| P2.5 | `team-dashboard` viz type       | #12 Team Dashboard                   |
| P2.6 | `release-point` chart variant   | #4 Release Point Plot                |

If student survey signal later justifies promoting any of these into `bbdata viz`, re-open from `git log` — the prior detail sections (data requirements, file targets) are recoverable from this file's history before 2026-04-19.

---

## Pending — details

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
| R5.0 | Strategic: adopt `ExecutionContext` per command       | Shipped  | —        | XL       | v0.9.0 — 2026-04-19 — implemented `ExecutionContext` class in `src/context/execution.ts`; replaced redundant config, cache, and stdin adapter loading logic in `query.ts`, `report.ts`, and `viz.ts` |

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

### R5.0 — Strategic: `ExecutionContext` per command invocation — **Shipped 2026-04-19**

**What:** Route `query`, `report`, and `viz` through a single `ExecutionContext` object that carries config, source policy, cache policy, input payload, and adapters for the life of the invocation.

**Why:** R1.1 (caching), R1.3 (stdin state), and R2.1 (source toggles) are all symptoms of the same pattern — per-concern plumbing duplicated across commands, drifting out of sync. One context object + consistent wiring fixes all three in one refactor and prevents future divergence.

**What shipped:**
- Created `src/context/execution.ts` with `ExecutionContext` class to handle common configuration parsing, caching, and stdin adapters logic.
- Updated `src/commands/query.ts`, `src/commands/report.ts`, and `src/commands/viz.ts` to instantiate and use `ExecutionContext`.

**Verification:**
- `npm run test` passed with 253/253 tests across the entire suite.

---

## Suggested sequencing

Phase A (P1.1, P1.2b, P1.3, P3.2, P3.3, P4.1, P4.2, P4.3) shipped in v0.7.0; Phase B (P3.1) in v0.7.1; Phase C (P3.4) in v0.7.2. Phase D (R1.1, R1.2, R1.3, R2.1, R4.1, R5.0, P4.5) shipped in v0.9.0 on 2026-04-19. P2.x cancelled 2026-04-14 via course-side rewrite.

Remaining, in rough order:
1. **P4.4** — course-side edit only. Pick option (c) (drop the 8 `/build-model equivalent` callouts in Module 05) unless they turn out to be load-bearing, in which case option (a) (remap to real template IDs). No bbdata work either way.
2. **Opportunistic:** adopt `assertFields` (shipped in v0.9.0 as P4.5's helper) in the 9 other templates that use `.includes()` on optional stdin fields — listed in the P4.5 "Other templates with the same pattern" note above. Drop-in when those templates next get touched.
