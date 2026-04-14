# bbdata TASKS — post-audit backlog

Source: `../ai-baseball-data-analyst/course-audit.md` (2026-04-13). These are the CLI-side items that, if shipped, close gaps between what the Baseball AI Community course promises and what `bbdata` actually does.

**Important trade-off:** every pending item below is an *alternative* to a course-content fix in the audit. If the course rewrites Module 04's Visualization Template Library deliverable (~4h edit), most of Priority 2 becomes optional. Decide on the course vs. CLI direction first, then pick from this list.

Status legend: **Ship** = do it / **Decide** = design question first / **Later** = roadmap.

---

## Shipped in v0.7.x

| Item | Version | Evidence |
|---|---|---|
| P1.1 — `--format png` on `viz` | v0.7.0 | `src/commands/viz.ts:28` (format enum), `package.json:54` (`@resvg/resvg-js` in `dependencies`), `src/viz/rasterize.ts` |
| P1.2 — viz-type aliases (option b) | v0.7.0 | `src/viz/charts/index.ts:23–28` registers `pitching-movement`, `hitting-spray`, `hitting-zones`, `trend-rolling` |
| P1.3 — `--window N` on `rolling` | v0.7.0 | `src/commands/viz.ts:167`, consumed in `src/viz/charts/rolling.ts` |
| P3.1 — `--format pdf` | v0.7.1 | `src/viz/render.ts` `specToPdf()`, commit `c504e0c` |
| P3.2 — `--format html` | v0.7.0 | `src/viz/render.ts` `specToHtml()` |
| P3.4 — `--data <path>` (JSON + CSV file input) | v0.7.2 | `src/utils/data-input.ts`, `src/adapters/savant-csv.ts` (shared with Savant adapter), wired in `src/commands/{query,report,viz}.ts` |
| P3.3 — `--dpi <n>` flag | v0.7.0 | `src/commands/viz.ts:165` (propagates to PNG rasterization and PDF render) |
| P4.1 — query-template docs | v0.7.0 | `README.md:56–64` lists all 21 templates, including the 9 previously-undocumented |
| P4.2 — `draft-board-card-pitcher` doc | v0.7.0 | `README.md:95` |
| P4.3 — `--audience` harmonization | v0.7.0 | `src/commands/report.ts:85–106` (`resolveReportAudience()` normalizer), documented at `:382` |

---

## Priority 2 — New viz types (only if not rewriting Module 04)

Each of these is referenced in `Modules/04/Deliverables/Visualization Template Library.md` as a shipped `bbdata viz <type>` command. If Aaron rewrites that deliverable (audit recommendation #1), **skip this section entirely**.

### P2.1 — Add `pitching-heatmap` viz type — **Later**
- **What:** KDE density plot of pitch locations in the zone.
- **Data:** existing `pitcher-raw-pitches` query supplies `plate_x`, `plate_z` per pitch.
- **Effort:** L (~4–6h — new chart builder + fixtures + tests)
- **Files:** `src/viz/charts/pitching-heatmap.ts` (new), `src/viz/charts/index.ts`, `test/fixtures/viz/`

### P2.2 — Add `hitting-barrel` viz type — **Later**
- **What:** Exit velocity vs. launch angle scatter with barrel/hard-hit zones overlaid.
- **Data:** existing `hitter-raw-bip` query supplies `launch_speed`, `launch_angle`.
- **Effort:** L (~4–6h)
- **Files:** `src/viz/charts/hitting-barrel.ts` (new), `src/viz/charts/index.ts`

### P2.3 — Add `percentile-chart` viz type — **Later**
- **What:** Savant-style horizontal percentile bars (e.g., xwOBA 92nd percentile).
- **Data:** needs a new `player-percentiles` query template upstream, or can derive from FanGraphs season data.
- **Effort:** L (~6h — requires new query template + new chart)

### P2.4 — Add `comparison-table` viz type — **Later**
- **What:** Color-coded multi-player stat comparison table, rendered as SVG/PNG (not the existing `leaderboard-comparison` markdown output).
- **Effort:** L (~4–6h)

### P2.5 — Add `team-dashboard` viz type — **Later**
- **What:** Multi-chart composite for a team. Course uses `--team NYY --unit pitching|hitting`.
- **Effort:** XL (~1–2 days — composite layout, team-level data adapter work)
- **Blocks:** also introduces `--unit pitching|hitting` flag, `--team` on viz command.

### P2.6 — Add `release-point` chart as a variant — **Later**
- **What:** Release point consistency scatter. Course references it in Module 04 Lesson 3:95.
- **Data:** `pitcher-raw-pitches` has `release_pos_x`, `release_pos_z`.
- **Effort:** M (~3h)

---

## Priority 3 — Output / input format expansion

*(P3.4 shipped in v0.7.2 — see Shipped table above.)*

---

## Priority 4 — Documentation / discoverability (bbdata side)

### P4.4 — Decide fix path for `/build-model equivalent` fake query names in Module 05 Deliverable — **Decide**
- **Why:** Course file `ai-baseball-data-analyst/Modules/05 - Code & Model Building/Deliverables/Model Template Library.md` has 8 `/build-model equivalent` callouts (lines 89, 152, 216, 279, 358, 423, 490) with `bbdata-cli query <name>` invocations that reference 6 template IDs not present in `src/templates/queries/`: `pitcher-stats`, `statcast-pitches`, `hitter-stats`, `hitter-splits`, `pitcher-game-logs`, `hitter-statcast`. Verified 2026-04-14 via direct grep over every `id: '...'` line in the queries registry. Students copying these bash lines hit "template not found". The course shipped with the wrong names; bbdata didn't drift. Analogous to P1.2 for viz types.
- **Options:**
  - **(a) Course-side rewrite** — remap each fake name to the closest real template (e.g., `hitter-stats` → `hitter-season-profile`; `statcast-pitches` → `pitcher-raw-pitches`; `hitter-splits` → `hitter-handedness-splits`; `pitcher-game-logs` → `pitcher-recent-form`). Zero CLI work, ~30min course edit.
  - **(b) bbdata alias layer** — register the 6 fake names as aliases for closest-fitting real templates. Preserves course content verbatim. Requires judgment on the least-surprising mapping per name; some (`hitter-stats`) are ambiguous enough that any alias choice will confuse half the use cases.
  - **(c) Drop the callouts entirely** — the `/build-model` slash command is flagged in the course audit Section A as "Shipped (by design)" — it generates Python / prompts, not CLI calls. So the `/build-model equivalent` bash blocks may not be load-bearing in the first place; removing them is cleaner than either a rewrite or an alias layer that pretends the course authors picked real names.
- **Recommendation:** (c) — if `/build-model` is Python-generation rather than CLI-passthrough, the "CLI equivalent" callouts are misrepresenting the product surface. Removing them is truer to how the feature actually works. (a) is the fallback if the callouts are genuinely load-bearing for some student workflow.
- **Effort:** S (~30m) for (a) or (c); M (~1h) for (b) including defensible alias mappings.
- **Files:** (a/c) `ai-baseball-data-analyst/Modules/05 - Code & Model Building/Deliverables/Model Template Library.md`; (b) new alias layer in `src/templates/queries/index.ts`.

---

## Non-bbdata items from the audit (for reference, not action)

All of these are course-side fixes and do **not** involve bbdata:

- Rewrite `Modules/04/Deliverables/Visualization Template Library.md` (course)
- Fix `/viz --type compare|dashboard|heatmap|barrel|percentile` across Module 04 Lesson/Outline/Deliverables (course)
- Correct survey figures: "83 analysts" → 67 in `Project Dashboard.md:46`; Coach 16 → 11 at `:50`; "68" → "67" across Module READMEs (course)
- Rewrite `.claude/skills/viz/SKILL.md` "12 templates" → "5 CLI + 7 Python prompts" (course)
- Add `audience` reference table to Module 04 Lesson 4 (course)
- Rewrite or remove the 8 `/build-model equivalent` callouts in `Modules/05/Deliverables/Model Template Library.md` that reference non-existent bbdata query template IDs — see **P4.4** above for the three fix paths and a lean toward option (c)

---

## Suggested sequencing

Phase A (P1.1, P1.2b, P1.3, P3.2, P3.3, P4.1, P4.2, P4.3) shipped in v0.7.0; Phase B (P3.1) shipped in v0.7.1; Phase C (P3.4) shipped in v0.7.2.

Remaining backlog, in rough order:
1. P2.1 (`pitching-heatmap`) — Module 04 Lesson 3 leads with it, so highest student-visibility of the Priority 2 set
2. Remaining P2.x in whatever order survey signal favors
3. P4.4 — course-side decision; pick option (c) unless callouts turn out to be load-bearing

Effort estimates assume one focused half-day per M item.
