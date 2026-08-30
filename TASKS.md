# bbdata TASKS — post-audit backlog

Source: `../ai-baseball-data-analyst/course-audit.md` (2026-04-13). CLI-side items that close gaps between what the Baseball AI Community course promises and what `bbdata` actually does.

**This file is now two backlogs.** P1.1–P1.3 / P2.x / P3.1–P3.4 / P4.1–P4.5 and the R-series came from the 2026-04 audit and Codex reviews, and are almost entirely shipped. **P1.4 onward came from a different place: the `video-hyperframes` lesson facts gates**, which query bbdata live for every number that goes on screen and have caught a wrong-number defect in most lessons since 2026-07-26. Those are the open work — see "Start here" below.

**Resolved 2026-04-14:** course-side rewrite shipped (audit recommendation #1). `ai-baseball-data-analyst/Modules/04 .../Deliverables/Visualization Template Library.md` now explicitly marks 8 of 12 templates as AI-prompt-only and adds a canonical-types appendix. Commit `2046dd5` in `ai-baseball-data-analyst`. All P2.x items are cancelled — see the "Cancelled" section below.

---

## Start here

**As of 2026-08-29: the entire filed CLI backlog is closed.** The 14-item P1
wave merged to main in PR #27; P2.7, P3.5, P3.6, and P4.6–P4.11 are fixed on
this branch (unreleased — see "Unreleased" section). What remains is
release + course-side work:

- **Release:** `npm version minor` (breaking for typed library consumers:
  `PitchDataSchema` nullable tracking fields; behavior change: `--audience`
  strict validation) after `npm login` and the COURSE_TEST_PLAN re-runs.
- **Course-side follow-ups:** the `trend-year-over-year` lesson command needs
  `--stat pitching` appended; the matchup teammate example (already filed
  course-side); the m03-l04 `--validate` teaching should be re-checked now
  that `--no-strict --validate` fails on hollow reports; lesson annotations
  quoting `N = 386` batted balls will drift on re-capture (P3.6 retains
  tracking-dropout rows); `query-data/SKILL.md` drift — row 49 says
  "Situational stats, RISP, **leverage**" (MLB has no leverage splits; drop
  the word) and row 53's `trend-year-over-year` params should mention
  `--stat pitching` for pitchers.

Verify anything before fixing it — several entries are four months old and the
adapters fetch live data:

```bash
npm test          # vitest
npm run typecheck
npm run lint
npx bbdata query <template> --player "<name>" --season 2025   # reproduce
```

**Suggested order.** Grouped by shared root cause, cheapest first — several of
these are one fix, not several:

1. ~~**The percent-formatting family — P1.4, P1.5, P1.6.**~~ **Fixed 2026-08-29
   (unreleased).** Shared `fmtPercent` in `src/utils/stat-format.ts`; formatters
   no longer guess — percent rendering requires a template-declared
   `columnFormats()` hint. See the "Unreleased" section.
2. ~~**Wrong quantity, not wrong scale — P1.10, P1.17.**~~ **Fixed 2026-08-29
   (unreleased).** One root cause as predicted: the stat lookup stripped `%`/`+`
   from both sides, colliding `BB%` with `BB` and `wRC+` with `wRC`. See the
   "Unreleased" section.
3. ~~**Fabricated and mislabeled values — P1.11, P1.16.**~~ **Fixed 2026-08-29
   (unreleased).** The six tracking columns are nullable end-to-end (schema +
   adapter + every consumer), and arsenal break renders in true inches (×12).
   See the "Unreleased" section.
4. ~~**Silent wrong answers — P1.15, P1.7.**~~ **Fixed 2026-08-29 (unreleased).**
   Savant's CSV endpoint needed `hfPT` (the plain `pitch_type` param is ignored,
   same gotcha as `hfGT`), enforced at three layers including cache hits; the
   arsenal swing set gains `hit_into_play` and Put Away % is now real put-away
   rate. See the "Unreleased" section.
5. **Zero-row failures on the course's own printed examples — P1.8, P1.9, ~~P1.12~~.**
   Each is a command a student runs verbatim from a lesson and gets nothing back.
   **All three fixed 2026-08-29 (unreleased)** — stat aliases + actionable
   errors for P1.12; a real multi-season fetch and comparison for P1.9;
   server-side matchup filtering for P1.8.
6. **Then P1.13, P1.14, P2.7, P3.5, P3.6** and the v0.10.0 preflight P4 backlog:
   P4.6 (fixture thickening), P4.7 (`matchup-situational` assertFields + straggler
   audit), P4.8 (`report --audience` enum validation), P4.9 (COURSE_TEST_PLAN
   wording), P4.10 (`SO` missing from `pitcher-season-profile`), P4.11 (raw-pitches
   field gaps — a scope decision, not a bug).

**Two things to know before starting.** Fixes in `src/templates/` and
`src/adapters/` land in the JSON envelope, so they reach students, agents and
`scout-app` alike; fixes in `src/formatters/` are terminal-only. And the course
material quotes bbdata output in lesson text and video scripts — a corrected
number may need a matching course-side edit in `../ai-baseball-data-analyst/`.

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
| P4.4 | Fix `/build-model equivalent` fake query IDs | Migrated | P4       | —         | Moved to `../ai-baseball-data-analyst/Tasks.md` 2026-04-21 — course-side edit, no bbdata work unless options (a)+(c) are rejected |
| P4.5 | Friendly error for minimal-field stdin JSON  | Shipped  | P4       | —         | v0.9.0 — 2026-04-19 — new `assertFields()` helper in `src/utils/validate-records.ts`; applied to `pitcher-arsenal.transform()` with the fields it dereferences; error names every missing field + points at the PitchData schema |
| P4.6 | Thicken shared Savant CSV fixture for `pitcher-by-count` + `pitcher-tto` stdin smoke | Fixed — unreleased | P4 | S | **Fixed 2026-08-29** — option (a): fixture thickened in place with `balls`/`strikes`/`inning`/`at_bat_number` across all 13 rows, with count values covering all four count-state buckets (even/ahead/behind/two-strike) and a 4-PA sequence that exercises TTO assignment. Q.6 renders all 4 count states, Q.7 renders the TTO table; full suite unaffected. Original filing: 2026-04-21 |
| P4.7 | Extend `assertFields` retrofit to `matchup-situational` + audit stragglers | Fixed — unreleased | P4 | S | **Fixed 2026-08-29** — `matchup-situational` guards on `stats` (Q.15's pitch-level payload now gets the actionable message); the straggler audit added guards to `trend-year-over-year` (`season`/`stats`) and `hitter-zone-grid` (`plate_x`/`plate_z` — an all-zero grid on sparse stdin is a wrong answer, not a degraded one) and confirmed the remaining raw/count templates degrade by design. Retrofit suite parameterized to 12 templates. Original filing: 2026-04-21 |
| P4.8 | Reject unknown `--audience` values on `report` | Fixed — unreleased | P4 | S–M | **Fixed 2026-08-29** — both resolution sites (`resolveReportAudience` in report.ts and `resolveVizAudience` in viz/types.ts) now throw on unknown values with the accepted list + aliases instead of silently coercing to analyst. Verified live: R.A7 exits non-zero. Minor-bump behavior change as filed. Original filing: 2026-04-21 |
| P4.9 | COURSE_TEST_PLAN wording accuracy fixes      | Fixed — unreleased | P4 | XS | **Fixed 2026-08-29** — all three wording edits (R.7 "Times Through **the** Order", F.22 viridis as `rgb(…)`, F.19 config-gate third outcome) ported from PR #26, which fixed them alongside its subset of the P1 wave. Original filing: 2026-04-21 |
| P1.4 | `pitcher-season-profile` reports `K-BB%` off by 100× | Fixed — unreleased | **P1** | XS | **Fixed 2026-08-29** — shared `fmtPercent` hoisted to `src/utils/stat-format.ts` with the normalize guard (ratios ×100, already-scaled values pass through); regression tests in `test/utils/stat-format.test.ts` + `test/templates/season-profile.test.ts`; verified live (Webb 2023 K-BB% renders 19.2%). Original filing: 2026-07-26 — `bbdata query pitcher-season-profile --player "Logan Webb" --season 2023` returns `K-BB%  0.2%`; real figure ~18.6%. **Confirmed at source:** `src/templates/queries/pitcher-season-profile.ts:32` — `fmtPercent` does `` `${Number(v).toFixed(1)}%` `` but FanGraphs returns the rate as a **ratio** (`0.186`), so it renders `0.2%`. Blast radius is exactly one metric: `fmtPercent` is file-local and only `K-BB%` (line 47) uses it. Fix should normalize rather than blindly `× 100` (`Math.abs(v) <= 1 ? v * 100 : v`) so it survives FanGraphs switching representation. **P1 despite XS effort — wrong numbers reach students and `scout-app`.** Found while verifying on-screen figures for `video-hyperframes/m01-l02-v2` |
| P4.10 | `pitcher-season-profile` exposes no strikeout total | Fixed — unreleased | P4 | S | **Fixed 2026-08-29** — `SO` and `BB` rows added to the traditional block (after GS), with MLB-key aliases for the fallback path. Verified live: Webb 2023 → SO 194, BB 31. Original filing: 2026-07-26 — template returns W-L, ERA, IP, GS, FIP, xFIP, SIERA, K-BB%, WAR but no `SO`. `--source mlb-stats-api` returns all `—` for this template, so there is no fallback. SO is the most-requested line-score stat in the course material; a video panel had to substitute FIP. Add `SO` (and probably `BB`) to the fangraphs transform |
| P1.5 | `hitter-season-profile` reports `BB%` and `K%` off by 100× | Fixed — unreleased | **P1** | XS | **Fixed 2026-08-29** — same fix as P1.4: both templates now import the shared helper, local copies deleted; verified live (Judge 2023 BB% 19.2%, K% 28.4%). Original filing: 2026-07-31 — `bbdata query hitter-season-profile --player "Aaron Judge" --season 2023` returns `BB% 0.2%` and `K% 0.3%`; real marks ~18.5% and ~28.0%. **Same defect as P1.4, and it corrects P1.4's scoping:** `fmtPercent` is not file-local to one template — it is duplicated verbatim at `src/templates/queries/pitcher-season-profile.ts:32–33` and `src/templates/queries/hitter-season-profile.ts:25–26`, and the hitter file applies it to **two** metrics (lines 38–39). So the real blast radius is 3 metrics across 2 files, not "exactly one metric". Fix both together with the same normalize-don't-multiply guard P1.4 proposes (`Math.abs(v) <= 1 ? v * 100 : v`), and hoist the helper to one shared util so a third template can't re-introduce it. **P1 for the same reason as P1.4 — this is the JSON envelope, so wrong numbers reach agents, students, and `scout-app`, not just the terminal.** Found while running the on-screen facts gate for `video-hyperframes/m01-l03` |
| P1.6 | `table`/`markdown` formatters guess percentages from magnitude, corrupting indices, counts and rate stats | Fixed — unreleased | **P1** | S | **Fixed 2026-08-29** — heuristic removed from both formatters; per-column hints via new optional `QueryTemplate.columnFormats()` (`'percent'` \| `{ decimals: n }`) threaded through `query.ts` → `format()`; a survey of all 22 templates confirmed zero relied on the heuristic (every real percent is pre-formatted as a string in the transform). Defaults: integers stay integers, sub-1 floats get 3 decimals, others 1. `pitcher-raw-pitches` declares `{ decimals: 2 }` for pfx/plate columns. Verified live: zone-grid indices render 0/1/2 and xwoba 0.386. Original filing: 2026-07-31 — **distinct from P1.4/P1.5: this one is the presentation layer, not the templates.** `src/formatters/table.ts:45` and `src/formatters/markdown.ts:35` both apply `if (Math.abs(value) <= 1 && value !== 0) → (value * 100).toFixed(1) + '%'` to every numeric cell. Any legitimate value in (−1, 1) is silently rewritten as a percentage. Confirmed on `hitter-zone-grid --player "Aaron Judge" --season 2023`: `row`/`col` grid indices render `0.0 / 100.0% / 2.0` (index `1` → `100.0%`), and `xwoba 0.386` renders `38.6%` — an xwOBA is conventionally `.386`, never a percentage. Also hits `hitter-vs-pitch-type`, where a Slurve `In Play` count of `1` renders `100.0%` while every neighbouring row shows a plain count. **JSON output is correct**, so the fix is confined to the two formatters and no envelope consumer is affected — but every human-facing table is suspect, which is exactly the surface the course teaches from and the surface a video panel gets transcribed off. A magnitude heuristic cannot distinguish a ratio from an index; the column needs a declared type. Templates already declare `columns()` — carry a per-column format hint through it instead of guessing. Found while running the on-screen facts gate for `video-hyperframes/m01-l03` | **Corroborated 2026-08-17** by the `video-hyperframes/m02-l03` facts gate, which hit the same defect in three more places in one sitting: `leaderboard-custom` renders `Rank` 1 as `100.0%`, `hitter-vs-pitch-type` renders `In Play` 1 as `100.0%` (Ohtani 2025, `FO`/`CS` rows), and `pitcher-arsenal` renders its trailing `PO` row's `Pitches` count as `100.0%`. Three of the twelve templates a single lesson teaches. Raises confidence that the per-column format hint is the right fix, not a widened heuristic |
| P1.7 | `pitcher-arsenal` overstates `Whiff %`; `Put Away %` is not put-away rate | Fixed — unreleased | **P1** | S | **Fixed 2026-08-29** — swing set gains `hit_into_play`; `Put Away %` recomputed as strikeouts per two-strike pitch using the BBDATA-011 `strikes`/`events` fields (`—` when count data absent). Verified live: Skubal 2025 changeup whiff 63.6% → 45.7%, matching Savant. Original filing: 2026-08-17 — `src/templates/queries/pitcher-arsenal.ts:69-71` builds the swing denominator as `description.includes('swing') \|\| description.includes('foul')`. Statcast's `description` for a batted ball is `hit_into_play`, which matches **neither** substring, so **every ball put in play is missing from the denominator** and whiff % is inflated for every pitch of every pitcher. Measured: Strider 2023 slider reports **68.8%** against a true Savant figure near 46%; the four-seamer reports 33.9% against ~30%. Separately, `Put Away %` (line 90) is computed as `whiffs / count` — whiffs over *all* pitches of that type — which is not put-away rate (strikeouts / two-strike counts) under any definition, and its `twoStrikes` guard (line 75) filters `description` for `'strikeout'`, a value that only ever appears in Statcast's `events` field, so the guard is effectively dead. Two mislabeled columns on **the single most-taught template in the course** (M02 L03 calls it "the workhorse"). Fix: add `hit_into_play` (and `foul_tip`) to the swing set; either compute real put-away rate from `events` + count state or rename the column. Found while running the on-screen facts gate for `video-hyperframes/m02-l03`, which had to drop both columns from the lesson's arsenal table and cut "whiff rate" from the narration |
| P1.8 | `matchup-pitcher-vs-hitter` returns 0 rows for valid matchups | Fixed — unreleased | **P1** | M | **Fixed 2026-08-29** — root cause: the live Savant CSV has no batter-name column (the test fixture misleadingly did), so the client-side name filter matched nothing; the adapter now resolves `opponent_name` and filters server-side via `batters_lookup[]`. Bonus fix: AVG/SLG were computed per PA, not per AB. Verified live: Gausman/Judge 2024 → 10 PA, 3 HR, .500/1.625. The teammate-pair lesson example remains a course-side fix. Original filing: 2026-08-17 — returns `0 rows` for every pair tried: Judge/Cole at seasons 2026 and 2024, and **Judge/Gausman 2024**, a genuine and frequent AL East matchup. (The Judge/Cole pairing can never work regardless — they are Yankees teammates and never face each other — but that is a bad *example*, and the Gausman run isolates a real template failure.) A student following M02 L03 runs this and gets nothing. **The lesson's own printed example is the teammate pair** (`ai-baseball-data-analyst/Modules/02 .../Lessons/03 - Pre-Built Query Templates.md:268`) — that half is a course-side fix, filed separately |
| P1.13 | `--no-strict` promises placeholders the shipped templates never emit, so `--validate` passes hollow reports | Fixed — unreleased | **P1** | S | **Fixed 2026-08-29** — took the second of the two proposed options: new `required-data` validation check promotes each failed required query into a `severity: error` issue, so `--no-strict --validate` on a hollow report banners `failed` and names what's missing; the strict-mode error text no longer promises placeholder stubs. Verified live (Burnes 2027): banner reads `failed (2 issues; … required-data)`. Course note: m03-l04 teaching may need updating for the new behavior. Original filing: 2026-08-25 — strict mode's own error text (`src/commands/report.ts:271`) says *"Pass `--no-strict` to emit a stub-shell report with placeholders instead."* It doesn't. `Data pending` / `data goes here` come only from `generateFallbackTemplate()` (`:178-190`), which runs **only when a registered template has no `.hbs` file** — and all 13 registry ids have one, so it is dead code today. The real `.hbs` templates degrade per-section with `*Arsenal data not available*` etc., which `placeholder-free` (`:359`) does not look for. **Net effect: `placeholder-free` is unreachable through every documented path, and it is the only check that raises an `error`** — the other three warn (`:377` filters `passed` on `severity === 'error'`). So `--validate` returns `validation: passed`, zero issues, on a report with no data in it. Reproduced live 2026-08-25 on five templates (`pro-pitcher-eval`, `pro-hitter-eval`, `relief-pitcher-quick`, `trade-target-onepager`, `draft-board-card`) with both required queries returning 0 rows — all five passed. **P1 because a green banner on an empty report is worse than no banner**, and because M03 L04 is the lesson that teaches this flag. Fix is a choice, not a patch: either make the `.hbs` per-section fallbacks emit the sentinel strings, or promote a failed-required-query count into `validateReport()` as an error. Course-side already corrected to teach the true behaviour — see `video-hyperframes/m03-l04/FACTS-PREFLIGHT.md` §2. **Renumbered 2026-08-29 from P1.9** — it had been filed into an ID the 2026-08-17 `trend-year-over-year` entry already held; artifacts citing "P1.9" for the `--validate` defect mean this row |
| P1.14 | `report` stamps every report with the **UTC** date, so evening runs are dated tomorrow | Fixed — unreleased | P3 | XS | **Fixed 2026-08-29** — `toLocaleDateString('en-CA')` replaces `toISOString().split('T')[0]` at `src/commands/report.ts`; verified live at 8:18pm PDT (UTC already 08-30): report stamps 2026-08-29. Original filing: 2026-08-25 — `src/commands/report.ts:294` builds the header field as `new Date().toISOString().split('T')[0]`. `toISOString()` is always UTC, so from 5pm PDT onward every report claims it was generated on a day that has not started for the user. Observed directly: at **2026-08-25 20:32 PDT** a `pro-pitcher-eval` run wrote `**Generated:** 2026-08-26`. Cosmetic against P1.4–P1.9, but it lands in the one line a reader uses to decide whether a report is current, and it silently breaks any pipeline that greps the header date or filenames reports by it. Fix: format in local time (`toLocaleDateString('en-CA')` gives the same `YYYY-MM-DD` shape) or make the timezone explicit. Found while capturing the M03 L04 demo asset — the one-day gap between the capture and every other artifact in the lesson is what surfaced it. **Renumbered 2026-08-29 from P1.10** — it had been filed into an ID the 2026-08-17 `leaderboard-comparison` entry already held |
| P1.9 | `trend-year-over-year` returns 0 rows; `--seasons` appears not to drive the fetch | Fixed — unreleased | **P1** | M | **Fixed 2026-08-29** — the template had never implemented multi-season at all (`buildQuery` ignored `--seasons`, transform hardcoded `Prior: '—'`). Now: `AdapterQuery.start_season` + FanGraphs `season1`/`ind=1` range fetch (page widened to 2000 — 500 truncated multi-season pulls), real Prior/Current/Change/⚠ comparison, explicit per-metric key variants (no `wRC+`→`wRC` collision), `--stat pitching` mode, and an actionable pitcher hint when the batting pull is an all-zero 0-PA line. **Course-side follow-up:** the lesson's printed Burnes example needs `--stat pitching` appended. Original filing: 2026-08-17 — `bbdata query trend-year-over-year --player "Corbin Burnes" --seasons 2024-2025` returns `0 rows`, and the error names `season=2026` (the default) rather than the requested range. Adding an explicit `--season 2025` changes the reported season but still returns 0 rows, so `--seasons` is not reaching the adapter query. Uses the fangraphs / mlb-stats-api chain, not savant. **This exact command is the lesson's printed example** (`:413`) and one of the twelve M02 L03 teaches |
| P1.10 | `leaderboard-comparison` reports `BB%` as a raw walk count | Fixed — unreleased | **P1** | XS | **Fixed 2026-08-29** — `findStatValue` stripped `%`/`+` from both metric and key, so `BB%` → `bb` matched FanGraphs' raw `BB` column first; lookup is now exact case-insensitive against explicit key variants, and rate metrics format via shared `fmtPercent` (K% now renders `19.2%`, closing this row's side-note). Regression: `test/templates/leaderboard-comparison.test.ts`. Original filing: 2026-08-17 — `--players "Juan Soto,Aaron Judge,Shohei Ohtani" --season 2025` renders a `BB%` row as **127 / 124 / 109**. Those are walk totals, not rates. The `K%` row directly above is a true ratio (0.192 / 0.236 / 0.257), so the two rate rows in one table disagree about representation — and note `K%` is *also* wrong-looking to a reader expecting `19.2%`, which is the P1.6 formatter question. Distinct from P1.4/P1.5 (`fmtPercent` ×100) because the value here is the wrong *quantity*, not the wrong scale. Found by the `video-hyperframes/m02-l03` facts gate, which excluded the row from the on-screen comparison |
| P1.11 | `savant-csv` silently zero-fills missing spin rate and movement instead of preserving `null` | Fixed — unreleased | **P1** | XS | **Fixed 2026-08-29** — all six columns route through `numOrNull`; `PitchDataSchema` widened to `.nullable()` for them, and the compiler-enumerated consumers (arsenal averages via new `meanOf`, both trend templates' velo filters, both zone templates' location filters) now exclude dropouts from denominators instead of averaging fabricated zeros. Regression: `test/utils/data-input.test.ts` + `test/templates/pitcher-arsenal.test.ts`. Original filing: 2026-08-17 — `src/adapters/savant-csv.ts:47–52` coerces six columns with `Number(x) \|\| 0`: `release_speed`, `release_spin_rate`, `pfx_x`, `pfx_z`, `plate_x`, `plate_z`. Statcast leaves these blank routinely (tracking dropouts, older seasons), and `Number('') === 0`, so **a missing spin rate becomes a measured 0 rpm** — physically impossible, indistinguishable downstream from real data, and it drags every mean and every arsenal comparison toward zero. **The file already knows better twelve lines later:** `launch_speed`/`launch_angle` (53–54) use `row.x != null ? Number(x) \|\| null : null` and `hc_x`/`hc_y` (55–56) additionally guard `!== ''`. So this is an inconsistency *inside one object literal*, not a considered design choice — which is what makes it XS. Fix: route all six through the same `numOrNull` helper already imported and used at lines 68–73, with an empty-string guard. **P1 for the same reason as P1.4/P1.5 — this is the adapter, upstream of the `{ data, meta }` envelope, so the fabricated zeros reach students, agents and `scout-app` alike, not just the terminal.** Found during the facts-gate preflight for `video-hyperframes/m02-l04` — which is the *"Data Cleaning and Quality with AI"* lesson, and names these exact columns as commonly-missing while teaching students that a tool silently substituting a fill value is the failure you cannot see. The course's own data layer currently does it |
| P1.12 | `leaderboard-custom --stat barrel_rate` returns 0 rows — the template's own documented example | Fixed — unreleased | **P1** | S | **Fixed 2026-08-29** — explicit course-vocabulary alias map (`barrel_rate`→`Barrel%`, `hard_hit_rate`→`HardHit%`, `k_rate`→`K%`, `bb_rate`→`BB%`); an unresolvable stat now throws naming every available stat key instead of masquerading as an adapter 0-row error; `%`-keyed stats render via shared `fmtPercent`. Verified live: the lesson's exact flowchart command returns Judge 24.7% at rank 1. Original filing: 2026-08-20 — `bbdata query leaderboard-custom --stat barrel_rate --season 2025` (with or without `--min-pa`) errors `Adapter(s) [fangraphs, mlb-stats-api] returned 0 rows`. Not a fetch failure: `--stat HR` and `--stat wRC+` return correct rows in the same minute from the same fangraphs adapter. The stat key `barrel_rate` never resolves against the FanGraphs stats object — `findStat()` in `src/templates/queries/leaderboard-custom.ts:79` misses it even case-insensitively, every player filters out in the `withStat` pass, and the empty transform result masquerades as an adapter 0-row error (misleading twice over: the suggested fix "try an earlier --season" can never help). **`barrel_rate` is the template's own first documented example** (`leaderboard-custom.ts:17`) — and the exact command printed in the course lesson's flowchart (`ai-baseball-data-analyst/Modules/02 .../Lessons/05 - Building Your Personal Data Explorer.md:163`) and implied by its example question ("Who had the highest barrel rate among qualified hitters?"), so a student following M02 L05 hits a hard failure on the lesson's showcase command. Fix: either map course-vocabulary stat names (barrel_rate → the FanGraphs field, likely `Barrel%`) in `findStat`'s normalization, or fetch the missing field, and make the "stat not found" case error with the *available stat keys* instead of pretending 0 rows. Found by the on-screen facts gate for `video-hyperframes/m02-l05`, which swapped the on-screen example to a verified stat |
| P2.7 | `matchup-situational` returns only an `Overall` row, none of the promised splits | Fixed — unreleased | P2 | M | **Fixed 2026-08-29** — new `AdapterQuery.sit_codes` + MLB Stats API `stats=season,statSplits` fetch; template now renders Overall + 6 real splits (RISP, RISP 2-out, bases empty, late/close, innings 1–6, 7th+). MLB's situation vocabulary has no leverage codes, so the description drops "high leverage" for what's actually deliverable. Verified live: Freeman 2025 → 7 rows, RISP .323 vs bases-empty .270. Original filing: 2026-08-17 — `--player "Freddie Freeman" --season 2025` returns exactly one row (`Overall`, 627 PA, .295/.367/.502). The template's stated purpose is the four situational splits — RISP vs. bases empty, high vs. low leverage, close & late, innings buckets — and none come back. The overall line is correct but is not a split, so the template cannot currently illustrate what it is for. Related to P4.7, which flags the same template throwing on `assertFields` gaps |
| P3.5 | `hitter-vs-pitch-type` applies no minimum-pitch filter | Fixed — unreleased | P3 | XS | **Fixed 2026-08-29** — new `--min-pitches <n>` flag (default 20, matching the course prompt); pitch types below the threshold are dropped. Verified live: Ohtani 2025 renders 9 qualified rows, junk tail (Slurve 15, FO 4, FA 4, CS 3) gone. Original filing: 2026-08-17 — returns 13 rows for Ohtani 2025 including `Slurve` (15 pitches), `FO` (4), `FA` (4) and `CS` (3). The course prompt this template mirrors says "only include pitch types with at least 20 pitches faced" (M02 L03), so CLI and prompt disagree. The junk tail also drags in the P1.6 rendering defect. Suggest a `--min-pitches` flag defaulting to 20, or at minimum drop rows below a threshold |
| P1.15 | `pitcher-raw-pitches` silently ignores `--pitch-type` | Fixed — unreleased | **P1** | S | **Fixed 2026-08-29** — root cause was the Savant CSV endpoint ignoring the plain `pitch_type` URL param (same as the `hfGT` discovery); now sends `hfPT=SL\|`, plus post-parse filters in the adapter **and** the query layer so cache hits — including entries poisoned before the fix — come out filtered. Verified live: Skubal SL → 356 rows from warm cache. Closes carried defect D5. Original filing: 2026-08-29 — `bbdata query pitcher-raw-pitches --player "Tarik Skubal" --season 2025 --pitch-type SL` returns **byte-identical output** to the unfiltered call: 2,849 rows, still including all 895 changeups and 835 four-seamers. No warning, no error, exit 0. **Silent is the whole problem** — a student or agent filtering an arsenal down to one pitch gets the full arsenal back and every downstream mean, chart and comparison is computed over the wrong population, with nothing to indicate it. Either wire the flag through to the transform or reject it as unsupported on this template; a rejected flag is recoverable, a silently-ignored one is not. Carried in the video-hyperframes lesson artifacts as **D5** since 2026-08-26 (m03-l05, m04-l01) but never filed here. Re-verified live on 0.10.0 for `video-hyperframes/m04-l03` |
| P1.16 | `pitcher-arsenal` reports H/V break in **feet** under an inches label | Fixed — unreleased | **P1** | XS | **Fixed 2026-08-29** — break means multiply by 12 at format time, keeping the `in` suffix (Savant convention); type comments on `pfx_x`/`pfx_z` corrected feet-vs-inches. Verified live: Skubal 2025 changeup H Break 15.0 in (was 1.2 in). Original filing: 2026-08-29 — `pitcher-arsenal` renders `H Break` / `V Break` with an `in` suffix while the underlying value is in feet. Skubal 2025 changeup: `"H Break": "1.2 in"`. A changeup with 1.2 **inches** of horizontal break does not exist; 1.2 ft (14.4 in) is the real figure, and Statcast/Savant publish break in inches, so the label sets the reader's expectation and the number contradicts it by 12×. **A reader cannot detect this without knowing pitch physics** — the value is plausible-looking, just wrong by a constant. Raw `pfx_x`/`pfx_z` from `pitcher-raw-pitches` are correctly in feet and unlabeled, so the defect is confined to the arsenal template's presentation. Fix: multiply by 12 at format time, or drop the `in` suffix. First found 2026-08-27 by the `video-hyperframes/m04-l02` facts gate (Burnes), carried as **D6**, never filed; re-confirmed on Skubal 2026-08-29 for m04-l03, which had to bar all break magnitudes from screen |
| P1.17 | `leaderboard-comparison` and `hitter-season-profile` disagree on wRC+ by 41 points | Fixed — unreleased | **P1** | S | **Fixed 2026-08-29** — same root cause as P1.10: `wRC+` normalized to `wrc` matched FanGraphs' `wRC` (weighted runs created, 162.8 for Judge 2025) instead of `wRC+`; exact-match lookup + `fmtInt` now return **204**, agreeing with `hitter-season-profile` live. The decimal tell is gone too. Original filing: 2026-08-29 — for Aaron Judge 2025, `leaderboard-comparison --players "Aaron Judge,Shohei Ohtani,Juan Soto" --season 2025` reports wRC+ **162.8** while `hitter-season-profile --player "Aaron Judge" --season 2025` reports **204** for the same player, same season, same tool. The season-profile figure matches the public record and is consistent with the .331/.457/.688 slash both templates agree on; 162.8 is not wRC+ under any definition the slash line supports. **Two templates in one CLI returning different values for one metric is worse than either being wrong alone** — there is no way for a caller to know which to trust, and both reach students, agents and `scout-app` through the JSON envelope. Note the decimal is itself a tell: wRC+ is conventionally an integer. Distinct from P1.10 (BB% as a raw count) — that is the wrong *quantity* in one template; this is two templates disagreeing. Found by the `video-hyperframes/m04-l03` facts gate, which barred wRC+ from screen entirely as a result |
| P3.6 | `hitter-raw-bip` and `hitter-season-profile` disagree on home-run totals | Fixed — unreleased | P3 | S | **Fixed 2026-08-29** — took the retain-with-nulls option: batted balls are now selected by `description` (`hit_into_play`), not by tracking presence, so coordinate-less rows stay in the pull with null `hc_x`/`hc_y`; the spray chart filters unplottable points itself (a `null` coordinate would have coerced into a phantom point near home plate). Verified live: Judge 2025 → 388 batted balls, **53** home runs, matching the season profile. Original filing: 2026-08-29 — Aaron Judge 2025: `hitter-raw-bip` contains **52** `home_run` events across 386 batted balls, while `hitter-season-profile` and `leaderboard-comparison` both report **53** HR. One home run is absent from the batted-ball pull, most likely dropped for missing `hc_x`/`hc_y`. Low severity because the raw pull is not the place a caller reads a season total from, but it means any count derived by aggregating `hitter-raw-bip` is quietly short, and there is no `meta` field indicating rows were dropped. Fix: either retain coordinate-less batted balls with null coordinates, or report a dropped-row count in `meta`. Found by the `video-hyperframes/m04-l03` facts gate, which annotates its spray chart `N = 386 batted balls` and takes HR totals only from the season profile |
| P4.12 | Viz fixture gallery covers 4 of 6 chart types | Pending — awaiting decision | P4 | S | 2026-08-29 — `scripts/render-fixtures.ts` FIXTURES lacks `movement-binned` (could reuse `raw-pitches.sample.json`) and `pitcher-rolling` (needs a `pitcher-rolling-trend`-shaped fixture); `test/fixtures/viz/season-pitches.sample.json` is orphaned. Flagged by the registry-completeness reviewer three times (its original dogfood finding from 2026-04-26 plus both audits this session) — decide: add both fixtures, or accept the gap and delete the orphan |
| P4.13 | `report --help` "Available templates" block is hand-written | Pending | P4 | S | 2026-08-29 — `src/commands/report.ts` (~line 447) enumerates the 13 report templates by hand; currently in sync, but it's the same drift class that produced G.1 (query, 12 of 21 listed) and the v0.10.0 viz help bug. Generate from `listReportTemplates()` like `formatTemplateList()`/`formatChartTypeList()`; regression-test like `test/commands/query-help.test.ts` |
| P4.11 | `pitcher-raw-pitches` returns neither count state nor release coordinates, so two taught course templates cannot be built from bbdata | Fixed — unreleased | P4 | M | **Fixed 2026-08-29** — took option (a), widen the raw pull: `release_pos_x`/`release_pos_z` added to `PitchData` (optional+nullable) and parsed from the Savant CSV (columns confirmed present in the live export); `pitcher-raw-pitches` now passes through `balls`, `strikes`, `release_pos_x`, `release_pos_z`. Course Templates 3 and 4 can build from bbdata output. Verified live on Skubal 2025. Original filing: 2026-08-29 — `pitcher-raw-pitches` returns `pitch_type`, `release_speed`, `release_spin_rate`, `pfx_x`, `pfx_z`, `plate_x`, `plate_z`, `game_date`. Module 04 Lesson 03 ships twelve visualization templates, two of which name fields no bbdata template returns: **Template 3 (Pitch Mix by Count)** needs `balls` and `strikes`, and **Template 4 (Release Point Plot)** needs `release_pos_x` and `release_pos_z`. `pitcher-by-count` does not close the gap — it aggregates to four count *states* (Ahead / Even / Behind / Two-strike), not the twelve individual counts the template's prompt specifies. Both templates work from a raw Savant CSV export, which is what their "Required data" line actually points at, so **this is a scope decision, not a bug**: either widen the raw pull to pass these columns through (they exist in the Savant source — see P4.6, which wants `balls`/`strikes` in the CSV fixture for exactly this reason) or state in the course that these two templates are export-only. Filed so the decision is made deliberately rather than discovered by a student. Found by the `video-hyperframes/m04-l03` facts gate |

**P2.x are cancelled, not pending.** The course-side rewrite (2026-04-14) is the resolution the conditional was waiting on. Detail lives in the "Cancelled" section below.

---

## Unreleased — fixed 2026-08-29, awaiting next release

The percent-formatting family (suggested-order group 1). One shared root cause, closed together:

- **P1.4 + P1.5 — `fmtPercent` ×100 defect.** New shared helper `src/utils/stat-format.ts::fmtPercent` with the normalize-don't-multiply guard (`|v| ≤ 1` is treated as a ratio and scaled; larger values pass through, so it survives FanGraphs switching representation). The duplicated per-template copies in `pitcher-season-profile.ts` and `hitter-season-profile.ts` are deleted; both import the shared helper. Tests: `test/utils/stat-format.test.ts` (6) + two ratio-input regression cases in `test/templates/season-profile.test.ts` pinning the real FanGraphs representation (the pre-existing fixtures fed already-scaled values, which is why the bug survived). Verified live: Webb 2023 K-BB% → 19.2%; Judge 2023 BB% → 19.2%, K% → 28.4%.
- **P1.6 — magnitude-guessing formatters.** The `Math.abs(v) <= 1 → percent` heuristic is removed from `src/formatters/table.ts` and `src/formatters/markdown.ts`. A survey of all 22 query templates confirmed zero templates relied on it — every genuine percentage is pre-formatted as a string in the transform — so removal loses nothing and unbreaks Rank/index/count/xwOBA cells. Percent rendering now requires a declared type: new optional `QueryTemplate.columnFormats?(params)` returning `Record<string, 'percent' | { decimals: n }>` (registry.ts), threaded `query.ts` → `format()` → both formatters; the `'percent'` hint reuses the shared `fmtPercent`. New defaults with no hint: integers render as integers (fixes counts/indices; table and markdown now agree — table previously rendered small ints as `5.0`), sub-1 floats get 3 decimals (xwOBA `.386` convention), others 1. First hint user: `pitcher-raw-pitches` declares `{ decimals: 2 }` on `pfx_x`/`pfx_z`/`plate_x`/`plate_z` so columns straddling 1.0 don't mix precision. Tests: 8 new cases in `test/formatters/formatters.test.ts`. JSON/CSV envelopes untouched.

Full gate at fix time: 334/334 tests, typecheck and lint clean.

Wrong-quantity family (suggested-order group 2), fixed 2026-08-29 in the same session:

- **P1.10 + P1.17 — `leaderboard-comparison` stat-key collisions.** One root cause, as the triage predicted: `findStatValue` normalized both the metric name and every candidate key with `.replace(/[+%]/g, '')`, so `BB%` → `bb` collided with FanGraphs' raw `BB` walk-count column (P1.10: 127/124/109 under a `BB%` label) and `wRC+` → `wrc` collided with `wRC` — weighted runs created, which is exactly where the mystery 162.8 came from (P1.17). `Object.entries` order decided the winner, and FanGraphs lists counting stats first. The transform now uses a `METRICS` spec table (label + explicit key variants + formatter, mirroring the season-profile templates): lookup is exact case-insensitive against listed variants only (`wRC+`/`wRCplus`, `BB%`/`BB_pct`, `K%`/`K_pct`, `HR`/`homeRuns`), and each metric formats via the shared `stat-format.ts` helpers — `fmtPercent` for K%/BB% (closing P1.10's side-note: K% renders `19.2%`, not `0.192`), `fmtInt` for wRC+/HR/RBI, `fmtFixed(3)` for the slash line (OPS now `1.144`, no longer chopped to `1.1`). `fmtFixed`/`fmtInt` were hoisted into `src/utils/stat-format.ts` alongside `fmtPercent` — leaderboard-comparison is the third consumer the P1.5 hoist rationale predicted. Verified live: Judge 2025 wRC+ **204** from both templates; BB% row 17.8%/18.3%/15.0%. Tests: `test/templates/leaderboard-comparison.test.ts` (7, both collisions pinned with fixtures carrying the colliding keys in FanGraphs order). Full gate: 341/341, typecheck and lint clean.

Fabricated/mislabeled family (suggested-order group 3), fixed 2026-08-29 in the same session:

- **P1.11 — `savant-csv` zero-fill.** `release_speed`, `release_spin_rate`, `pfx_x`, `pfx_z`, `plate_x`, `plate_z` now route through the file's existing `numOrNull` helper (empty-string guard included), and `PitchDataSchema` declares all six `.nullable()`. The type widening let the compiler enumerate every consumer doing arithmetic on them — exactly 5 files: `pitcher-arsenal` (averages now go through a new null-aware `meanOf` in `src/utils/aggregate.ts`; unmeasured metric renders `—`), `pitcher-velocity-trend` and `pitcher-rolling-trend` (velo filters gain null guards), and both zone templates (`hitter-zone-grid`, `hitter-hot-cold-zones` — the null guard matters doubly there, since JS coerces `null >= xMin` to `0 >= xMin` and would have filed untracked pitches into the middle zone). Semver note: the schema widening is breaking for library consumers typed against non-null tracking fields — next release should be a minor bump with a migration note. Tests: blank-cell CSV regression in `test/utils/data-input.test.ts`, dropout-mean + all-null cases in `test/templates/pitcher-arsenal.test.ts`.
- **P1.16 — arsenal break labeled inches, valued feet.** `H Break`/`V Break` means now multiply by 12 at format time, keeping the `in` suffix (matches how Savant publishes break). Type comments on `pfx_x`/`pfx_z` corrected — they carry feet. Verified live: Skubal 2025 changeup H Break **15.0 in** (previously rendered `1.2 in`); whole-arsenal values are physically sensible (four-seam +17.0 in vertical, curveball negative). Regression test pins `0.8 ft → 9.6 in`. Full gate: 345/345, typecheck and lint clean.

Silent-wrong-answer family (suggested-order group 4), fixed 2026-08-29 in the same session:

- **P1.15 — `--pitch-type` silently ignored on savant queries.** Root cause is the same class as the BBDATA-007 `hfGT` discovery documented in `savant.ts`: the CSV endpoint silently ignores a plain `pitch_type` URL param — only `hfPT=SL|` (pipe-delimited, trailing pipe) filters. Fixed at three layers: (1) the adapter now sends `hfPT`; (2) a post-parse filter in `savant.ts` guards against the endpoint regressing; (3) `query()` applies the same filter after `fetchWithCache`, because a warm cache hit never reaches the adapter — and entries cached *before* the fix hold the full unfiltered arsenal under filtered keys for up to `maxAgeDays` (Aaron's own repro run earlier on 2026-08-29 had poisoned the Skubal SL key exactly this way; discovered when the first post-fix live check still returned changeups from cache). The query-layer filter mirrors the stdin G.7 semantics: case-insensitive, PlayerStats rows pass through. Verified live: warm-cache Skubal `--pitch-type SL` → 356 rows, all SL. Closes defect **D5** carried in the video-hyperframes lesson artifacts since 2026-08-26. Tests: 2 in `test/adapters/savant.test.ts` (hfPT URL + defense-in-depth), 1 in `test/commands/query.test.ts` (poisoned-cache warm hit).
- **P1.7 — arsenal whiff % inflated; Put Away % was not put-away rate.** The swing denominator now includes `hit_into_play` (a batted ball matched neither `swing` nor `foul`, so every ball in play was missing from every whiff denominator). `Put Away %` is recomputed to its actual definition — strikeouts per two-strike pitch of that type — using the `strikes` count state and `events` (`strikeout` / `strikeout_double_play`) that BBDATA-011 added to `PitchData`; renders `—` when count data is absent (sparse stdin payloads), replacing the old `whiffs / count` formula and its dead `description.includes('strikeout')` guard. Verified live (Skubal 2025): changeup whiff 63.6% → **45.7%**, four-seam 34.2% → 25.0% — both consistent with published Savant figures. Tests: 3 new arsenal cases. Full gate: 351/351, typecheck and lint clean.

Ported from PR #26 (2026-08-29) — a parallel session independently fixed seven of the same P1 items; these are the two pieces it had that this branch lacked:

- **Movement-chart null handling (completes P1.11 at the chart layer).** Both movement charts multiply `pfx` by 12 before Vega sees the data, so a nullable `pfx` would coerce `null * 12` to 0 and pin dropped-tracking pitches at the origin. New shared `src/viz/charts/movement-values.ts` (`toMovementValues`) drops null-movement pitches and deduplicates the feet→inches / catcher-POV conversion that `movement` and `movement-binned` had each hand-rolled. Test: null-drop case in `test/viz/charts.test.ts`.
- **P4.9 — COURSE_TEST_PLAN wording fixes** (see the P4.9 row above).

Post-P1 backlog items fixed 2026-08-29 (after the P1-wave merge in PR #27):

- **P2.7 — `matchup-situational` now returns real splits.** The template's own comments admitted the gap ("works best with FanGraphs/MLB API aggregated splits" — neither adapter fetched any). New `AdapterQuery.sit_codes` + MLB Stats API support: one `stats=season,statSplits&sitCodes=…` call returns the season aggregate (rendered as Overall) plus one row per situation, each tagged with a new optional `PlayerStats.split` descriptor. The template requests `risp`, `risp2`, `r0`, `lc`, `ig01`, `ig07` and renders them in display order; a plain stdin PlayerStats payload still degrades to the single Overall row. FanGraphs is out of this template's source chain (its leaderboard API has no situational splits — that's why the defect existed). The MLB situation vocabulary has no leverage codes (probed live against `/situationCodes`), so the description now promises "RISP, bases empty, late & close, innings buckets" instead of "high leverage". Verified live: Freeman 2025 → Overall .295 plus six splits (RISP .323, bases empty .270, late/close .255, innings 1–6 .314 vs 7th+ .242). Tests: `test/templates/matchup-situational.test.ts` (4) + 2 MLB adapter cases.
- **P4.7 — `assertFields` stragglers closed.** `matchup-situational` guards on `stats` — Q.15's pitch-level `--data` payload now gets the actionable missing-field error instead of `TypeError: Cannot read properties of undefined (reading 'plateAppearances')`. The audit also added guards to `trend-year-over-year` (`season`/`stats` — the P1.9 rewrite would have thrown its own unactionable TypeError on pitch-level input) and `hitter-zone-grid` (`plate_x`/`plate_z` — sparse stdin produced a silently all-zero 9-row grid, a wrong answer rather than a degraded one). Remaining templates confirmed to degrade by design (null-guarded filters). `test/templates/assert-fields-retrofit.test.ts` parameterized to 12 templates (3 × 12 = 36).

- **P3.5 — `hitter-vs-pitch-type` minimum-pitch filter.** New `--min-pitches <n>` flag (`QueryTemplateParams.minPitches`, CLI-wired), defaulting to 20 per the course prompt the template mirrors. The 3-pitch junk tail that rendered 100%-style rates — and dragged in the old P1.6 formatter defect — is gone by default; `--min-pitches 1` restores the full table. Tests: `test/templates/hitter-vs-pitch-type.test.ts`.
- **P3.6 — `hitter-raw-bip` no longer quietly short.** Batted balls are selected by `description === hit_into_play`, not by having tracking data, and coordinate-less rows are retained with null `hc_x`/`hc_y` — so counts aggregated from the pull match the season profile (Judge 2025: 388 BBE, **53** HR, previously 52/386). The spray chart gained the corresponding null-coordinate guard: `null - 125.42` would have coerced into a phantom point near home plate. Course note: lesson annotations quoting `N = 386` from the old behavior will drift by a couple of rows on re-capture. Tests: `test/templates/hitter-raw-bip.test.ts`.

P4 preflight backlog, fixed 2026-08-29 in the same session:

- **P4.6 — fixture thickened in place** (option a): `test/fixtures/savant-csv-sample.csv` gains `balls`/`strikes`/`inning`/`at_bat_number` with count values covering all four count-state buckets and a 4-PA TTO sequence. Q.6 and Q.7 preflight rows now render real tables from stdin.
- **P4.8 — unknown `--audience` values rejected** at both resolution sites (`report` and `viz`) with an "expected one of" message listing canonical values and aliases. R.A7 exits non-zero. Minor-bump behavior change, as the filing anticipated.
- **P4.10 — `pitcher-season-profile` gains `SO` and `BB`** in the traditional block. Webb 2023 renders SO 194 / BB 31 live.
- **P4.11 — scope decision taken: widen the raw pull.** `PitchData` gains optional nullable `release_pos_x`/`release_pos_z` (parsed from the Savant CSV — columns confirmed present in the live export); `pitcher-raw-pitches` passes through `balls`, `strikes`, and both release coordinates with `{ decimals: 2 }` hints. The course's Pitch Mix by Count (Template 3) and Release Point Plot (Template 4) can now build from bbdata output instead of requiring a raw Savant export.

Also fixed 2026-08-29 in the same session:

- **P1.12 — `leaderboard-custom --stat barrel_rate` 0 rows.** Two-part fix. (1) An explicit `STAT_ALIASES` map resolves course vocabulary to FanGraphs keys: `barrel_rate`→`Barrel%`, `hard_hit_rate`→`HardHit%`, `k_rate`→`K%`, `bb_rate`→`BB%`. Explicit entries only — a general `_rate`-suffix normalization would collide `bb_rate` with the raw `BB` count column, the P1.10 defect class. (2) When a stat resolves for zero players, the transform now throws an error naming the requested stat and every available stat key, instead of returning `[]` and masquerading as "adapter returned 0 rows — try an earlier --season" (misleading twice over). Bonus: `%`-keyed stats render through the shared `fmtPercent` (Barrel% shows `24.7%`, not `0.247`), and sort direction is derived from the canonical key so `bb_rate` sorts like `bb%`. Verified live with the lesson's exact flowchart command (`--stat barrel_rate --season 2025 --min-pa 200`): Judge 24.7%, Ohtani 23.4%, Stanton 21.9% — the public leaderboard. Tests: `test/templates/leaderboard-custom.test.ts` (4).
- **P1.14 — report header stamped with the UTC date.** `new Date().toLocaleDateString('en-CA')` replaces `toISOString().split('T')[0]` — same `YYYY-MM-DD` shape, local clock. Verified live at 8:18pm PDT (when UTC is already the 30th): `**Generated:** 2026-08-29`.
- **P1.13 — `--validate` no longer passes hollow reports.** Took the second of the filing's two options: a new `required-data` check in `validateReport()` receives the report's failed-required-query list and raises a `severity: error` issue per failure, so `--no-strict --validate` on a report with no data banners `failed` and names each missing query — the string-sentinel `placeholder-free` check stays (it still guards the fallback-template path) but is no longer the only error-severity check. The strict-mode error text stops promising "a stub-shell report with placeholders" that never existed; it now describes the real degraded-sections behavior and points at `--validate`. Verified live (Burnes, empty 2027 season, `--no-strict --validate`): banner reads `failed (2 issues; checks: …, required-data)` over the `*Arsenal data not available*` sections that used to validate green. **Course note:** m03-l04 was corrected earlier to teach the buggy behavior; re-check it against the new honest behavior. Tests: 2 new report cases. Full gate: 376/376.
- **P1.8 — `matchup-pitcher-vs-hitter` found no matchups because it filtered on names Savant never sends.** The template fetched the pitcher's full season and filtered by `batter_name` client-side — but the live Savant search CSV carries no batter-name column, so `parseSavantCsv` fell back to `Unknown (#id)` for every row and the filter matched nothing, ever. (The shared test fixture *does* carry a `batter_name` column, which is why tests never caught it. Also, the "0 rows" in the original filing came from hitter-first argument order — Judge-as-pitcher fetches zero pitches; with pitcher-first order the symptom was the "No matchup data found" note row.) Fix: `AdapterQuery.opponent_name` + the savant adapter resolving the opponent and filtering server-side via `batters_lookup[]` (Savant accepts both lookups at once), with an actionable "Opponent not found" error; the transform keeps the name filter for stdin payloads and treats a single-batter payload as the matchup. **Bonus fix while verifying:** AVG and SLG were computed per plate appearance, not per at-bat — 4-for-8-with-2-BB rendered `.400` instead of `.500`; now uses the AB convention of `hitter-vs-pitch-type` (excludes walks/intentional walks/HBP/sacs). Verified live: Gausman/Judge 2024 → 43 pitches, 10 PA, 3 HR, AVG .500, SLG 1.625. The lesson's teammate-pair example (Cole/Judge, who never face each other) remains a course-side fix. Tests: `test/templates/matchup-pitcher-vs-hitter.test.ts` (5) + 2 savant adapter cases. Full gate: 374/374.
- **P1.9 — `trend-year-over-year` was a placeholder, not a wiring miss.** `buildQuery` ignored `--seasons` entirely (defaulted to the current year → 0 rows), and even with data the transform hardcoded `Prior: '—'` with a comment calling multi-season "a future enhancement". Now implemented end-to-end: `AdapterQuery` gains `start_season`, the FanGraphs adapter fetches ranges via `season1` + `ind=1` (one row per player-season, `PlayerStats.season` set from the row's `Season` field, and `pageitems` widened to 2000 for multi-season pulls — the default 500 truncates a two-season qual=0 leaderboard, empirically exactly 2000 rows for 2024–2025), and the transform compares the two most recent seasons with per-metric Change and a ⚠ flag on >10% relative moves. Stat lookup uses explicit key variants (the old `%`/`+`-stripping `findStat` had the P1.10/P1.17 collision class: `wRC+`→`wRC`, `BB%`→`BB`). Adds `--stat pitching` (ERA/FIP/xFIP/WHIP/K%/BB%/K-BB%/IP/WAR) since the lesson's printed example is a pitcher, and detects a pitcher's all-zero 0-PA batting line, throwing "re-run with `--stat pitching`" instead of rendering a table of 0.000s. Verified live: Judge 2024→2025 batting table matches the public record; Burnes `--stat pitching` correctly flags the injury-shortened 2025 (IP 194.1 → 64.1 ⚠). **Course-side follow-up:** the lesson's printed command needs `--stat pitching` appended (same class as P1.8's teammate-example half). Tests: `test/templates/trend-year-over-year.test.ts` (10) + 2 FanGraphs adapter range cases. Full gate: 367/367.

---

## Shipped in v0.10.0

- **F1.1 — pro-pitcher-eval rolling trend chart.** New query template `pitcher-rolling-trend` (5-start sliding window; Avg Velo from fastball family, Whiff %, K %, CSW %) and new chart type `pitcher-rolling`. `src/viz/embed.ts` re-routes `pro-pitcher-eval`'s `rollingChart` slot to the pitcher-specific chart; the generic `rolling` chart stays hitter-only and still powers `pro-hitter-eval`. Outings with <10 tracked pitches are filtered before windowing. Registry grows 21→22 query templates and 5→6 chart types. Full detail in the F1.1 section below.
- **Footer partial wiring fix.** `src/templates/reports/partials/footer.hbs` existed with `{{cliVersion}}` but was never registered and no `.hbs` template referenced it — reports rendered without any version line (and without the AI-assistance disclaimer the partial carries). Fixed by registering the partial once at module load in `src/commands/report.ts` and converting all 13 report templates + the `generateFallbackTemplate` fallback to `{{> footer}}`. Regression test at `test/commands/report.test.ts` reads version from `package.json` and asserts it appears in the rendered output, so future refactors can't re-orphan the partial.
- **`assertFields` retrofit + regression coverage across 9 query templates.** The P4.5 helper shipped in v0.9.0 on `pitcher-arsenal` is now applied to the nine other templates that dereference optional-in-stdin fields (`hitter-handedness-splits`, `hitter-hot-cold-zones`, `hitter-vs-pitch-type`, `leaderboard-comparison`, `leaderboard-custom`, `matchup-pitcher-vs-hitter`, `pitcher-handedness-splits`, `pitcher-velocity-trend`, `trend-rolling-average`) — retrofit landed in commit `f6989fa`, regression guard at `test/templates/assert-fields-retrofit.test.ts` parameterizes one suite across all nine (3 tests × 9 templates = 27). Also fixes a placement bug in `pitcher-velocity-trend`: `assertFields` ran *after* a fastball filter that silently dropped sparse records, so the guard was unreachable — moved to run on the raw input with `game_date` added to its required fields.
- **COURSE_TEST_PLAN.md + TEST_PLAN.md consolidation.** New standing test plan `COURSE_TEST_PLAN.md` cross-references every bbdata claim in `ai-baseball-data-analyst/.claude/skills/*/SKILL.md` + deliverables against the actual CLI surface. 8 sections, ~100 rows, tagged **C** (Claude-automatable structural check) or **A** (needs Aaron — perceptual/live-network). Replaces the versioned `TEST_PLAN.md`, which had begun to drift (v0.9.0 section referenced a nonexistent `fixtures/burnes-2025.json`). Release smoke is now a subset of COURSE_TEST_PLAN rows re-run against the sections a release touches — see "Release smoke process" section and the updated `.claude/commands/release-preflight.md` step 6.
- **G.1 — `bbdata query --help` enumerates all registered templates.** Previous hardcoded help string listed 12 of 21 templates; students discovering templates via `--help` missed the 9 bonus templates shipped across v0.7.x–v0.9.0 (`pitcher-raw-pitches`, `pitcher-recent-form`, `pitcher-by-count`, `pitcher-tto`, `pitcher-season-profile`, `hitter-zone-grid`, `hitter-raw-bip`, `hitter-season-profile`, `hitter-handedness-splits`). New `formatTemplateList()` helper in `src/commands/query.ts` buckets the live registry by `QueryCategory` at help-render time. Regression test: `test/commands/query-help.test.ts`.
- **G.7 — `--pitch-type` filter works with `--data` and `--stdin`.** Previously the flag was silently a no-op on the stdin path — passing `--pitch-type FF --data fixture.csv` returned all pitch types. Network adapters honored the filter; stdin adapter didn't. Fixed in `src/adapters/stdin.ts` by applying `query.pitch_type` (case-insensitive set) to pitch-level records before returning; no-op on `PlayerStats` records (which don't carry `pitch_type`). Regression tests: 4 new cases in `test/adapters/stdin.test.ts`. Discovered via COURSE_TEST_PLAN row F.12 spot-check.
- **`bbdata viz --help` enumerates all registered chart types.** Companion to G.1 on the viz side: F1.1 shipped `pitcher-rolling` in the chart-builder registry but the hand-written help block in `src/commands/viz.ts` still listed only the original 5, so the new chart was undiscoverable. New `formatChartTypeList()` helper at `src/commands/viz.ts` generates the block dynamically from `listChartTypes()` + `listChartAliases()` against a `Record<ChartType, string>` description map — so the compiler forces a description entry whenever a new `ChartType` is added. Regression test: `test/commands/viz-help.test.ts` (3 tests). Discovered via `/release-preflight` step 6 C-row run on COURSE_TEST_PLAN §1/§4.

---

## Shipped in v0.9.0

Codex senior-eng review cleanup + one course-audit follow-up. **Breaking**
for library consumers that imported `getStdinAdapter()` / relied on
`loadDataFile()` being void (R1.3). CLI surface (flags, args, output) is
unchanged. See `CHANGELOG.md` for the full migration guide and
`COURSE_TEST_PLAN.md` §2–§5 for cross-reference coverage.

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

### P4.6 — Thicken shared Savant CSV fixture for `pitcher-by-count` + `pitcher-tto` stdin smoke — **Pending, surfaced 2026-04-21**

**Issue:** `test/fixtures/savant-csv-sample.csv` (13 pitches, 2025-04-15) is the shared pitch-level fixture for stdin-path C rows in `COURSE_TEST_PLAN.md` §2A. But it only carries 23 columns (pitch identity + movement + launch + xwOBA), omitting `balls`, `strikes`, `inning`, and `at_bat_number`. `pitcher-by-count.ts` and `pitcher-tto.ts` both guard on count state / inning number and skip every record whose count or inning is nullish (`if (pitch.balls == null || pitch.strikes == null) continue`), so the transform returns `[]`, the adapter reports "0 rows", and the command exits 1 with *no* stack trace. Q.6 and Q.7 fail preflight with an unactionable error.

**Options:**
- **(a) Thicken the existing fixture in place** — add the 4 missing columns (`balls`, `strikes`, `inning`, `at_bat_number`) across the 13 existing rows with plausible values. Pros: one fixture, all pitch-level C rows keep passing. Cons: other template tests that assert `data.Count` might shift if their row totals change on the richer fixture.
- **(b) Companion rich fixture `test/fixtures/savant-csv-rich.csv`** — carve out a second fixture for templates that need count/inning context, point Q.6/Q.7 at the new file. Pros: minimal fixture stays minimal. Cons: two fixtures to keep in sync.

**Recommendation:** (a) unless a template test fails on the richer row. The savant endpoint returns these columns by default — the fixture is underspec'd relative to real adapter output, so thickening it brings the fixture closer to production.

**Acceptance:** Q.6 and Q.7 exit 0 with non-empty `data` on the preflight C-row script; existing 309+ test suite still green.

### P4.7 — Extend `assertFields` retrofit to `matchup-situational` + audit stragglers — **Pending, surfaced 2026-04-21**

**Issue:** `/release-preflight` step 6 §2A Q.15 fires `bbdata query matchup-situational --player "Burnes Corbin" --data test/fixtures/savant-csv-sample.csv --format json` and gets:

```
✗ Adapter "stdin" threw while fetching "matchup-situational" (player=Burnes Corbin, season=2026):
  Cannot read properties of undefined (reading 'plateAppearances')
```

The v0.10.0 `assertFields` retrofit covered the 9 templates we knew were at risk (`pitcher-arsenal` plus 8 more documented in the v0.10.0 CHANGELOG Fixed section). `matchup-situational` is the first discovered miss — it dereferences a `.plateAppearances`-gated field on an intermediate object that the stdin fixture doesn't produce, so it throws the unactionable `TypeError` instead of the retrofit's "missing field X — see `PitchData` / `PlayerStats` schema" message.

**What ships:**
- **(1)** Add `assertFields` to `src/templates/queries/matchup-situational.ts` with the exact fields the transform dereferences (likely `plateAppearances` + whatever it chains on).
- **(2)** Parameterize `test/templates/assert-fields-retrofit.test.ts` to cover `matchup-situational` as the 10th template (3 tests × 10 = 30).
- **(3)** One-pass audit of the remaining ~12 templates not in the retrofit list — `matchup-pitcher-vs-hitter` (already retrofitted but worth re-verifying), `pitcher-raw-pitches`, `pitcher-recent-form`, `pitcher-by-count`, `pitcher-tto`, `hitter-zone-grid`, `hitter-raw-bip`, `hitter-batted-ball`, `pitcher-season-profile`, `hitter-season-profile`, `trend-year-over-year` — for the same class of unguarded dereference on thin stdin. Add to retrofit where warranted.

**Acceptance:** Q.15 preflight C row returns an actionable missing-field error (exit non-zero, message names the template + missing field, points at schema).

### P4.8 — Reject unknown `--audience` values on `report` — **Pending, surfaced 2026-04-21**

**Issue:** `/release-preflight` step 6 §3A R.A7 expects `bbdata report pro-pitcher-eval --audience bogus` to exit non-zero with a message listing accepted values. Actual: exits 0, silently coerces `meta.audience = "analyst"`, renders the report. This is a student-hostile failure mode — typos ("fronoffice", "preesentation") silently produce the wrong styling without any warning, and the course teaches a 6-value audience vocabulary so there's real surface area for typos.

**What ships:**
- Audience resolution site is `src/commands/report.ts:85–106` per CLAUDE.md reference. Add an enum validator (Zod-style or hand-rolled) that accepts the 6-value input vocabulary — canonical (`coach`, `gm`, `scout`, `analyst`) + aliases (`frontoffice` → `gm`, `presentation` → `analyst`) — and throws with a helpful "expected one of: …" message on anything else.
- Mirror the check on `viz` (`--audience` flag) if it has the same silent-coercion behavior (preflight only exercised the report path in R.A7; viz coercion lives in `src/viz/types.ts::resolveVizAudience` and does fall through to `analyst` on unknown input — same fix shape).
- New test cases in `test/commands/report.test.ts` (and `test/commands/viz.test.ts` if viz is included): one per accepted value + one rejecting an unknown value with the expected message shape.

**Semver impact:** Technically breaking for any programmatic caller that relied on unknown-audience fall-through to `analyst` — but that's an under-documented pre-existing behavior the course never advertises. Likely a minor-bump behavior change, same reasoning as R1.1.

**Acceptance:** R.A7 preflight C row passes; existing audience coverage rows R.A1–R.A6 still pass.

### P4.9 — COURSE_TEST_PLAN wording accuracy fixes — **Pending, surfaced 2026-04-21**

**Issue:** `/release-preflight` step 6 v0.10.0 C-row run surfaced three false-positive FAILs that are purely test-plan wording drift — the CLI behavior is correct; the expected-column text is off.

**Edits to `COURSE_TEST_PLAN.md`:**
- **R.7 `advance-sp`:** Expected heading reads "Times Through Order"; the `advance-sp.hbs` template renders "Times Through **the** Order". Update the row to match the template's actual text (or normalize to case-insensitive substring match on "Times Through").
- **F.22 `--colorblind`:** Expected assertion is "SVG source contains viridis palette hex codes". Vega-Lite emits viridis scheme colors as `rgb(59, 82, 139)` / `rgb(33, 145, 141)` / `rgb(93, 201, 99)` (three category samples on the movement chart), not as `#440154`-style hex. Update the assertion to match `rgb\(` forms OR the viridis scheme's rgb triplets specifically.
- **F.19 `--source baseball-reference`:** Row currently says "Exit non-zero with 'no adapter for baseball-reference' OR exit 0 with `meta.source === 'baseball-reference'`". Actual behavior surfaced in the v0.10.0 run is a third outcome: **exit 1 with a helpful "disabled in config" error pointing at `~/.bbdata/config.json → sources.baseballReference.enabled = true`**. This is actually the *correct* R2.1 behavior shipped in v0.9.0. Update the row to accept the config-gated error as a third valid outcome.

**Acceptance:** next `/release-preflight` run reports zero false-positive FAILs on R.7 / F.22 / F.19.

---

### P4.4 — `/build-model equivalent` fake query names — **Migrated 2026-04-21**

Moved to `../ai-baseball-data-analyst/Tasks.md` under "Course audit follow-ups" on 2026-04-21. The recommended resolutions (a course-side remap or simply dropping the 8 callouts) are pure content edits in `Modules/05 - Code & Model Building/Deliverables/Model Template Library.md`. The bbdata fallback — a CLI-side alias layer — is only revisited if both course-side options are rejected.

### P4.5 — Friendly error for minimal-field stdin JSON — **Shipped 2026-04-19**

**Issue (resolved):** `pitcher-arsenal.transform()` dereferenced `pitch.description.includes(...)` on every record. Hand-authored stdin / `--data` fixtures without the full Savant field set crashed with `TypeError: Cannot read properties of undefined (reading 'includes')`, pointing the stack trace at the template rather than the missing input field. Real Savant exports always include these fields — the bug only surfaced for tutorial / test / minimal payloads.

**What shipped:**
- **New helper** `src/utils/validate-records.ts` — `assertFields(records, requiredFields, templateId)`. Checks the first record (payloads are homogeneous in practice), collects *every* missing field into one message, and points at `src/adapters/types.ts` for the full PitchData / PlayerStats contract.
- **Applied to `pitcher-arsenal.ts`** with its actual dereferenced fields: `description`, `release_speed`, `release_spin_rate`, `pfx_x`, `pfx_z`. (The existing `if (!pitch.pitch_type) continue` soft-skip is preserved for heterogeneous inputs — only the fields the template would otherwise silently NaN-out on or crash on are required.)
- **Tests:** two new cases in `test/templates/pitcher-arsenal.test.ts` — one verifies the error names the template + the specific missing field, the other verifies every missing field appears in one message (so a user fixing a sparse fixture edits all of them in one pass instead of bisecting).

**Chose (b) over (a):** per the original triage. Silent degradation ("Unknown" rows, NaN-filled stats) is worse than a fail-fast error with a schema pointer — analyst-user payloads should round-trip cleanly or die explicitly, not return dashboards full of dashes.

**Other templates with the same pattern — Shipped in v0.10.0.** The nine peer templates (`pitcher-velocity-trend`, `trend-rolling-average`, `hitter-handedness-splits`, `hitter-hot-cold-zones`, `hitter-vs-pitch-type`, `leaderboard-comparison`, `leaderboard-custom`, `matchup-pitcher-vs-hitter`, `pitcher-handedness-splits`) were retrofitted in commit `f6989fa` and covered by the parameterized suite at `test/templates/assert-fields-retrofit.test.ts`. See the "Shipped in v0.10.0" section above. (P4.7 captures the now-discovered straggler: `matchup-situational` still throws the unactionable `TypeError` on thin stdin.)

---

## From Codex repo review (2026-04-23)

Source: in-repo review run on 2026-04-23 after `npm run lint`, `npm run typecheck`, and `npm test` all passed. These are smaller contract / maintenance follow-ups, distinct from the course-audit backlog above.

### Status at a glance

| ID   | Title                                                | Status  | Priority | Effort | Notes |
|------|------------------------------------------------------|---------|----------|--------|-------|
| R6.1 | `viz()` programmatic return contract matches `format` | Shipped | P2       | S–M    | 2026-04-23 — branch `review-followups-2026-04-23`; add in-memory `formatted` payload + `meta.format` so `png` / `pdf` / `html` aren't write-only for library consumers |
| R6.2 | Retry only transient HTTP failures + clear timers     | Shipped | P2       | S      | 2026-04-23 — branch `review-followups-2026-04-23`; no retry on permanent 4xx, always clear abort timers, keep 429 / 5xx / network retries |
| R6.3 | Honor report `paramMapping` in sub-query dispatch     | Shipped | P3       | S      | 2026-04-23 — branch `review-followups-2026-04-23`; `report()` now derives query options from each template's mapping instead of ignoring the field |
| R6.4 | Suppress expected Vega empty-data warnings            | Shipped | P4       | XS     | 2026-04-23 — branch `review-followups-2026-04-23`; default render path logs errors only, with full Vega warnings still available under `BBDATA_DEBUG` |

### What shipped

- `R6.1` closes the mismatch where `VizOptions.format` accepted `png` / `pdf` / `html` but `viz()` only returned `{ svg, spec }` unless the caller also wrote a file. The programmatic API now exposes the rendered payload in-memory so library consumers can use the same formats as the CLI.
- `R6.2` hardens `src/utils/http.ts`: abort timers are cleared in all paths, permanent HTTP failures stop immediately, and retries stay focused on transient errors (`429`, `5xx`, aborts, and network failures).
- `R6.3` turns `paramMapping` in `src/templates/reports/registry.ts` into live configuration. Existing templates still behave the same, but future report templates can remap report-scope inputs into sub-query params without patching `report.ts`.
- `R6.4` removes noisy `Infinite extent` Vega warnings from empty-data render tests and normal CLI runs, while preserving the verbose warning stream when `BBDATA_DEBUG` is set.

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

**Test coverage:** `COURSE_TEST_PLAN.md` §3 (report smoke rows R.1–R.13) exercises `report --data` end-to-end including embedded graphs.

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

## From scout-app backlog (2026-04-21)

Feature extension surfaced by scout-app but requiring bbdata-side work. Numbered Fx to distinguish from audit (Px) and Codex-review (Rx) buckets.

### Status at a glance

| ID   | Title                                                 | Status   | Priority | Effort   | Notes                                                        |
|------|-------------------------------------------------------|----------|----------|----------|--------------------------------------------------------------|
| F1.1 | Wire pro-pitcher-eval rolling-trend chart             | Shipped  | P2       | —        | v0.10.0 — 2026-04-21 — new `pitcher-rolling-trend` query + `pitcher-rolling` chart type; `embed.ts` re-routed. Splits-chart half of the original scope was descoped — no dormant block existed. |

### F1.1 — Wire pro-pitcher-eval rolling-trend chart — **Shipped v0.10.0 (2026-04-21)**

**Issue (resolved):** `pro-pitcher-eval.hbs` had a `{{#if graphs.rollingChart}}` block at line 69 that was wired at both ends (template guard + `embed.ts` slot) but always rendered empty. The generic `rolling` chart type consumed `trend-rolling-average`, whose `buildQuery` hardcodes `stat_type: 'batting'` and whose transform computes hitter metrics (AVG/SLG/K%/Avg EV/Hard Hit %). Invoking it for a pitcher returned zero batting PAs → the chart fell through to the "Insufficient data" text mark on every pro-pitcher-eval report.

**What shipped:**
- **New query template** `src/templates/queries/pitcher-rolling-trend.ts` — 5-start sliding window with `stat_type: 'pitching'`, returning Avg Velo (fastball family only — FF / SI / FC), Whiff %, K %, CSW %. Step = `max(1, floor(window/3))` matching `trend-rolling-average`. Outings with <10 tracked pitches are dropped before windowing (filters position-player innings + one-batter relief). Registered in `src/templates/queries/index.ts`.
- **New chart type** `src/viz/charts/pitcher-rolling.ts` — sibling to `rolling.ts`, same wide→tidy pivot + faceted small-multiples structure, excluded metric key is `Starts` (instead of `Games`), fallback message references "5+ starts". `ChartType` union in `src/viz/types.ts` extended; registered in `src/viz/charts/index.ts`.
- **Embed wiring** `src/viz/embed.ts` — `pro-pitcher-eval`'s `rollingChart` slot now uses `type: 'pitcher-rolling'`; `pro-hitter-eval` still uses the hitter-only `rolling` type.
- **Tests:** `test/templates/pitcher-rolling-trend.test.ts` (11 tests, mirrors `pitcher-recent-form` patterns); 5 new `pitcherRollingBuilder` cases in `test/viz/charts.test.ts` covering pivot correctness, metric-key exclusion, facet spec, and graceful fallback; registry count bumped 21→22 in `test/templates/registry.test.ts`; `listChartTypes` expectation bumped 5→6.

**Descoped:** The "dormant splits chart" mentioned in the original F1.1 description did not actually exist — `pro-pitcher-eval.hbs` only has a splits *table*, no `{{#if graphs.splitsChart}}` block. Adding one would have been new scope (new template block + new chart type + new slot) rather than wiring. If you decide a pitcher splits chart is worth shipping, open a follow-up F-item.

**Granularity decision:** Per-start with a min-pitches-per-outing floor. The TASKS.md open question asked per-start vs per-month — per-start won because (a) it matches the hitter side's per-game granularity and (b) irregular x-axis spacing from starter rest days is handled naturally by the temporal encoding. Reliever-heavy usage is mitigated by the 10-pitch outing floor.

**Verification:**
- `npm run typecheck` — clean.
- `npm run lint` — clean.
- `npm test` — 309 / 309 pass (up from 253).
- `npm run build` — clean tsup build.

**Next:** bump `bbdata` dep in `../scout-app/package.json` after the next `npm version` + publish; smoke via `pro pitcher eval for Gerrit Cole 2024` in `/chat` (expected byte count lift to ~1.0–1.2MB once the third inline SVG fills in).

**Origin:** moved from `../scout-app/TASKS.md` #11 on 2026-04-21.

---

## Shipped history

Phase A (P1.1, P1.2b, P1.3, P3.2, P3.3, P4.1, P4.2, P4.3) shipped in v0.7.0; Phase B (P3.1) in v0.7.1; Phase C (P3.4) in v0.7.2. Phase D (R1.1, R1.2, R1.3, R2.1, R4.1, R5.0, P4.5) shipped in v0.9.0 on 2026-04-19. P2.x cancelled 2026-04-14 via course-side rewrite. P4.4 migrated to course-side Tasks.md on 2026-04-21. Phase E (F1.1 + vega/vega-lite 5→6 + assertFields retrofit + G.1/G.7 + footer partial wiring + viz `--help` drift fix) shipped in v0.10.0 on 2026-04-21.
