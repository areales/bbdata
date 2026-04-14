# bbdata TASKS — post-audit backlog

Source: `../ai-baseball-data-analyst/course-audit.md` (2026-04-13). These are the CLI-side items that, if shipped, close gaps between what the Baseball AI Community course promises and what `bbdata` v0.6.1 actually does.

**Important trade-off:** every item below is an *alternative* to a course-content fix in the audit. If the course rewrites Module 04's Visualization Template Library deliverable (~4h edit), most of Priority 2 becomes optional. Decide on the course vs. CLI direction first, then pick from this list.

Status legend: **Ship** = do it / **Decide** = design question first / **Later** = roadmap.

---

## Priority 1 — Small, high-leverage

### P1.1 — Add `--format png` to `viz` — **Ship**
- **Why:** Course's `Module 04/Deliverables/Visualization Template Library.md` uses `--format png` in all 12 examples. CLI currently accepts `svg` only. `@resvg/resvg-js` is already in `devDependencies` and is already used by `scripts/render-fixtures.ts` and `scripts/extract-report-assets.ts`, so the rasterizer is proven.
- **Change:** Move `@resvg/resvg-js` to `dependencies`; extend `viz` command's `--format` enum to `svg|png`; wire the SVG → PNG pipeline via the existing `rasterizeSvg` helper.
- **Effort:** M (~2h including tests + fixture PNGs)
- **Files:** `src/commands/viz.ts:115`, `src/viz/render.ts`, `package.json`

### P1.2 — Decide naming strategy for viz types — **Decide**
- **Why:** Course deliverable uses domain-prefixed names (`pitching-heatmap`, `hitting-barrel`, `trend-rolling`, `team-dashboard`) while CLI uses bare names (`movement`, `spray`, `zone`, `rolling`). Options:
  - **(a) Keep bare names, rewrite course** — zero CLI work, ~4h course rewrite.
  - **(b) Add aliases** — register `pitching-movement` → `movement`, `hitting-spray` → `spray`, `hitting-zones` → `zone`, `trend-rolling` → `rolling` in `src/viz/charts/index.ts`. Lets the course's existing `bbdata viz <prefixed-name>` lines work. ~30m.
  - **(c) Rename the shipped types and add legacy aliases for backward-compat** — more invasive, unnecessary unless (b) feels like tech debt.
- **Recommendation:** (a) if Aaron is rewriting Module 04 anyway; (b) if he wants a cheap CLI-side fix that unblocks the course without touching it.
- **Effort:** S for (b), ~30m

### P1.3 — Add `--window N` flag on `rolling` chart — **Ship**
- **Why:** Course example in `Modules/04/Deliverables/Visualization Template Library.md:466` uses `--window 5`. Currently the rolling window is hard-coded (5 for pitchers, 15 for hitters — see `trend-rolling-average` query template description).
- **Change:** Add optional `--window <n>` to `viz rolling` that overrides the default.
- **Effort:** S (~30m)
- **Files:** `src/commands/viz.ts`, `src/viz/charts/rolling.ts`

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

### P3.1 — Add `--format pdf` — **Decide**
- **Why:** Course uses `--format pdf` in `Modules/04/Lessons/05:119` and `Deliverables/Personal Visualization Pipeline.md:459`. Only meaningful after P1.1 ships PNG, since PDF wraps raster.
- **Effort:** M (~2h — add `pdfkit` or render SVG → PDF via resvg's Cairo path)
- **Dependency:** P1.1

### P3.2 — Add `--format html` — **Decide**
- **Why:** Course references `html` in `Modules/04/Deliverables/Personal Visualization Pipeline.md:91`. `vega-lite` is already a dep and supports native HTML embed output.
- **Effort:** M (~2h)

### P3.3 — Add `--dpi <n>` flag — **Decide**
- **Why:** Course uses `--dpi 300` in `Modules/04/Outlines/05:179`. Only meaningful for raster output (PNG/PDF).
- **Effort:** S (~30m)
- **Dependency:** P1.1

### P3.4 — Add `--data <csv>` flag for user-supplied data — **Decide**
- **Why:** Course uses `--data ./ohtani-pitches-2025.csv` to override adapter-fetched data. Extends the existing `stdin` adapter pattern into a file-path convenience. Useful for students iterating on the same CSV repeatedly.
- **Effort:** M (~2h)
- **Files:** `src/adapters/stdin.ts` (add file-read path), affected commands

---

## Priority 4 — Documentation / discoverability (bbdata side)

### P4.1 — Surface shipped-but-undocumented query templates — **Ship**
- **Why:** CLI ships 21 query templates; skill docs only name 12. Course mentions 12. The 9 unnamed ones: `pitcher-raw-pitches`, `pitcher-recent-form`, `pitcher-by-count`, `pitcher-tto`, `pitcher-season-profile`, `hitter-zone-grid`, `hitter-raw-bip`, `hitter-season-profile`, `hitter-handedness-splits`.
- **Change:** Expand `README.md` "Commands" section with the full query template table; mention in CHANGELOG 0.5.0.
- **Effort:** S (~30m)
- **Files:** `README.md`

### P4.2 — Surface `draft-board-card-pitcher` report template — **Ship**
- **Why:** Shipped but not in README examples or skill docs.
- **Effort:** S (~10m)

### P4.3 — Document `--audience` value divergence — **Ship**
- **Why:** `report` accepts `coach|gm|scout|analyst`; `viz` accepts `coach|analyst|frontoffice|presentation`. README doesn't call this out. Surprise waiting for anyone who tries `--audience gm` on a viz.
- **Fix:** Either harmonize (add `gm` alias for `frontoffice` on viz, `presentation` handler on report) OR document the divergence explicitly in README.
- **Effort:** S (~15m docs) or M (~1h harmonize + tests)

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

**If Module 04 is being rewritten (cheapest path):**
1. P1.1 (PNG output) — still worthwhile on its own
2. P1.3 (`--window` on rolling)
3. P4.1, P4.2, P4.3 (docs cleanup)
4. Defer Priority 2 entirely; revisit Priority 3 based on student feedback

**If Aaron wants to preserve the course content as written:**
1. P1.2 option (b) — register viz-type aliases (unblocks most of the broken deliverable)
2. P1.1 (PNG) + P3.3 (dpi)
3. P2.1 → P2.5 in whatever order survey signal favors (heatmap likely first — Module 04 Lesson 3 leads with it)
4. P3.1 (PDF) after P1.1 stabilizes

Effort estimates assume one focused half-day per M item.
