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

## Suggested sequencing

Phase A (P1.1, P1.2b, P1.3, P3.2, P3.3, P4.1, P4.2, P4.3) shipped in v0.7.0; Phase B (P3.1) in v0.7.1; Phase C (P3.4) in v0.7.2.

Remaining, in rough order:
1. **P2.1** (`pitching-heatmap`) — Module 04 Lesson 3 leads with it, highest student visibility
2. Remaining P2.x in whatever order survey signal favors
3. **P4.4** — course-side decision; pick option (c) unless callouts turn out to be load-bearing
4. **P4.5** — one-hour polish, drop in alongside any stdin-adapter or arsenal-template touch

Effort estimates assume one focused half-day per M item.
