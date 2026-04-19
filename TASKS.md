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
| P4.5 | Friendly error for minimal-field stdin JSON  | Pending  | P4       | S (~1h)   | Arsenal template crashes on sparse JSON with `Cannot read … 'includes'` |

**All P2.x items are conditional.** If Aaron rewrites `Modules/04/Deliverables/Visualization Template Library.md` (audit recommendation #1), skip the entire P2 section.

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

### P4.5 — Friendly error for minimal-field stdin JSON
- **What:** When the arsenal template receives a record missing fields it dereferences (e.g. a raw `[{pitcher_id, pitch_type, release_speed}]` fixture with no `description`/`game_type`/etc.), it crashes with `Cannot read properties of undefined (reading 'includes')`. Real-world Savant CSV/JSON exports always include these fields, so only hand-authored minimal fixtures hit it — but the error is inscrutable for anyone who does.
- **Where:** `src/templates/queries/pitcher-arsenal.ts` (and likely other templates that `.includes()` optional string fields inside `transform()`). Triaged 2026-04-14 during v0.7.2 smoke-test authoring (TEST_PLAN C.1d).
- **Fix options:**
  - **(a)** Guard the specific `.includes()` call sites with `field ?? ''` and accept that sparse records produce degraded-but-non-crashing output.
  - **(b)** Validate required fields at stdin-adapter boundary and emit a message like `Record missing field "description" — pitcher-arsenal needs description, game_type, game_year. See README schema.`
- **Recommendation:** (b) — fail fast at the boundary with a pointer to the schema is more teachable than silently returning "Unknown" rows.
- **Files:** `src/adapters/stdin.ts` or per-template `transform()`; new test case in `test/templates/pitcher-arsenal.test.ts`.

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
| R1.1 | Caching is unimplemented despite public contract      | Pending  | P1       | L (1–2d) | `--no-cache`, `cache.enabled`, `cache.maxAgeDays` are no-ops |
| R1.2 | `report --data` still triggers network fetches        | Pending  | P1       | M (~3h)  | Breaks offline/sandbox reports; nondeterministic output      |
| R1.3 | Global stdin adapter leaks state across calls         | Shipped  | P1       | —        | 2026-04-19 — singleton removed, `resolveAdapters(overrides)` + `createStdinAdapter()` per invocation; `loadDataFile` now returns an adapter; threaded through `query` / `report` / `viz` / `generateReportGraphs` |
| R2.1 | Source enable/disable config is ignored               | Pending  | P2       | S (~1h)  | Per-source toggles defined but never consulted               |
| R4.1 | Lint/release hygiene broken (eslint missing)          | Pending  | P4       | S (~1h)  | `npm run lint` fails on clean install                        |
| R5.0 | Strategic: adopt `ExecutionContext` per command       | Decide   | —        | XL       | Routes `query` / `report` / `viz` through one context object |

---

### R1.1 — Caching is unimplemented despite public contract

**Issue:** `query()` accepts `bypassCache`, but adapters never read/write cache, and `src/cache/store.ts` APIs are unused in the live data flow.

**Files:** `src/commands/query.ts:124`, `src/adapters/savant.ts:35`, `src/cache/store.ts:88`, `README.md:185`

**Why it matters:** `--no-cache`, `cache.enabled`, and `cache.maxAgeDays` are all no-ops. Behavior diverges from README docs. Reproducibility and perf are both degraded — every invocation hits upstream fresh.

**Fix:** add a shared cache layer in query execution (or in an adapter base class) that wraps fetch with `getCached` / `setCache`. Add integration tests for cold hit, warm hit, and `bypassCache` modes.

### R1.2 — `report --data` can still trigger network fetches for embedded graphs

**Issue:** Report query sections use the `stdin`/data path, but graph generation only forwards `stdin`, not `data`. So a `report --data foo.json` run still fires network calls inside embedded viz.

**Files:** `src/commands/report.ts:258`, `src/viz/embed.ts:49`, `src/viz/embed.ts:60`

**Why it matters:** Mixed data provenance (local + live network) produces nondeterministic reports and breaks the offline/sandbox workflow that `--data` implies.

**Fix:** propagate a unified "local data mode" (`stdin` OR `data`) into `generateReportGraphs()` and force `source: 'stdin'` for the viz layer when either is set.

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

### R2.1 — Source enable/disable config is defined but ignored

**Issue:** The config schema and README document per-source toggles, but `resolveAdapters()` does not consult them.

**Files:** `src/config/defaults.ts:15`, `src/commands/query.ts:103`, `README.md:161`

**Why it matters:** Operators cannot disable an unstable or disallowed source (relevant for compliance/rate-limit scenarios). Config is misleading — appears to work but silently does nothing.

**Fix:** filter preferred sources through config before `resolveAdapters()`. Normalize key naming (`mlbStatsApi` vs. `mlb-stats-api`) so both forms resolve to the same gate.

### R4.1 — Lint / release hygiene broken

**Issue:** `lint` script exists (`package.json:28`) but eslint is not in `devDependencies` (`package.json:68`); the publish gate at `package.json:31` (`prepublishOnly`) omits lint entirely.

**Why it matters:** `npm run lint` fails on any clean environment. Style/safety regressions can ship unnoticed because the publish pipeline never runs the linter.

**Fix:** add `eslint` + config/plugins to `devDependencies` and include `lint` in the `prepublishOnly` chain. Alternatively: remove the `lint` script if intentionally unsupported (and document the choice in CLAUDE.md).

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
