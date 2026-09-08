# bbdata COURSE_TEST_PLAN

Cross-reference test plan: every bbdata claim the **course** makes about this
CLI, verified against the actual `src/` surface. This is the **single living
test plan** for bbdata — per-release smoke is a subset of these rows re-run
against the sections a release touches (see "Release smoke process" below).

Scope sources (course side):
- `ai-baseball-data-analyst/.claude/skills/{query-data,scout-report,viz}/SKILL.md`
- `ai-baseball-data-analyst/Modules/**/Deliverables/*.md`
- `ai-baseball-data-analyst/Resources/bbdata User Guide.md`

Scope sources (CLI side): `src/cli.ts`, `src/commands/*.ts`, `src/templates/queries/*.ts`, `src/templates/reports/registry.ts`, `src/viz/charts/index.ts` — and the live `--help` output from a built `dist/bin/bbdata.js`.

## How to use

- **On the next CLI release** — follow the Release smoke process below.
- **On the next course push** that edits skills or deliverables, re-run the rows in the affected section.
- **Who runs which:**
  - **C** — Claude runs it. Structural checks: exit codes, `--help` text, JSON envelope shape, error strings, file headers, byte-for-byte SVG comparison.
  - **A** — Aaron runs it. Perceptual (does the chart *look* right), TTY behavior, live-network smoke, cross-project (scout-app, course skills).
- **Mark ✓** when the row's outcome matches expectation; mark **✗** and open a task if it doesn't.

## Release smoke process

For any `npm version` bump:

1. Identify the sections this release touched. Rough mapping:
   - New/changed query template → §1 (help enumeration), §2 (the template row), §5 (any new flag)
   - New/changed report template → §1, §3, §3A (audience), §3B (validate)
   - New/changed viz chart type or alias → §1, §4, §4A (formats)
   - New flag on any command → §1, §5
   - Behavior change in stdin/data/cache/source-resolution plumbing → §2 + §3 + §4 (the plumbing is shared)
2. Run every **C** row in the identified sections. `C` rows must pass before `npm publish`.
3. **A** rows are optional on patch, required on minor/major — live network, perceptual, and cross-project checks.
4. If a previously-passing `C` row now fails, treat it as a release blocker. If an `A` row was skipped on a prior release, re-run it on the first minor/major that touches the same surface.
5. Record nothing in this file per-release — the ✓ marks track *current* status, not a version history. Git log provides the version trail.

**Last full smoke: v0.12.0, 2026-09-07.** Sections re-run: §1, §3 (all C),
§3A, §3B, §4, §4A, §5 (every C row plus the live-network A rows F.13–F.18) —
the set 0.12 touched by adding a chart type, a flag behavior, per-audience
report sections and the scaffold marking. All passed. Two defects were found
by the smoke itself and fixed before the bump, both the same shape as the
release's own theme:

- `viz comparison --player "One Name"` exited 0 with an empty "No comparable
  season data" chart for a player who has data (V.C2). Row tagging was gated
  on a roster of 2+, so a one-name roster reached the builder untagged. It now
  errors, matching what the help text already said.
- Every `--validate` **warning** was collected and discarded — the CLI gated
  its issue printout on `!passed`, and warnings don't fail a report. That
  silently swallowed P5.2's scaffold notice, the whole point of which is to say
  a green banner covers a form and not an analysis (R.V3, R.V4).

Two row expectations were corrected rather than the CLI: F.17/F.18 tested
`--source` against a pitch-level template only Savant serves, and F.23 expected
`--size` to set the SVG canvas when it sets the Vega plot area.

§2, §6, §7 and §8 were not re-run — 0.12 added no query template, and §7/§8 are
Aaron's clean-env and course-skill rows. The prior v0.11.0 smoke covered §2A/§2B
in full.

Fixture conventions:
- `test/fixtures/savant-csv-sample.csv` — shared Savant CSV fixture for pitcher-side stdin/--data tests. Works for `pitcher-*`, `matchup-pitcher-vs-hitter`, and `trend-rolling-average` inputs. **Not** valid for `matchup-situational` (season-aggregate template since P2.7 — pitch-level input errors actionably; see Q.15/Q.23). Carries `balls`/`strikes`/`inning`/`at_bat_number` (P4.6) so the count-state and TTO templates return rows.
- `test/fixtures/viz/*.sample.json` — pre-shaped viz fixtures.
- Live-network rows use "Corbin Burnes" (SP), "Aaron Judge" (OF), "Shohei Ohtani" (DH/SP) as canonical examples since those are the course's canonical names too.

**Prereq — run this first, always:**

```powershell
npm run build
mkdir -Force .tmp
```

Several rows check output from the built `dist/bin/bbdata.js`. A stale `dist/` will make the recent partial-wiring fix (footer version line) fail R.1–R.13 spuriously — rebuild before running.

---

## §1 — Command presence + help text

The top-level `bbdata` binary and its three subcommands must exist and print the flags the course teaches.

| # | Who | Command | Expected | ✓ |
|---|---|---|---|---|
| H.1 | C | `node dist/bin/bbdata.js --version` | Prints package version. Non-zero exit if missing. | ✓ |
| H.2 | C | `node dist/bin/bbdata.js --help` | Lists three commands: `query`, `report`, `viz`. | ✓ |
| H.3 | C | `node dist/bin/bbdata.js query --help` | Lists `--player`, `--players`, `--season`, `--format`, `--source`, `--stat`, `--pitch-type`, `--min-pa`, `--min-ip`, `--min-pitches`, `--top`, `--seasons`, `--no-cache`, `--stdin`, `--data`. | ✓ |
| H.4 | C | `node dist/bin/bbdata.js report --help` | Lists `--player`, `--team`, `--season`, `--audience`, `--format`, `--validate`, `--no-strict`, `--stdin`, `--data`. Audience line must advertise `frontoffice→gm` and `presentation→analyst` aliases (from P4.3). | ✓ |
| H.5 | C | `node dist/bin/bbdata.js viz --help` | Lists `--type`, `--player`, `--players`, `--season`, `--audience`, `--format {svg,png,html,pdf}`, `--dpi`, `--pdf-mode`, `--window`, `--size`, `--colorblind`, `-o/--output`, `--source`, `--stdin`, `--data`. Lists the 7 canonical chart types (`movement`, `movement-binned`, `spray`, `zone`, `rolling`, `pitcher-rolling`, `comparison`) + 6 aliases. `--players` line must say it is for chart types that compare (P5.1); `--size` must say it sets the plot area, not the file's canvas. | ✓ |
| H.6 | C | `node dist/bin/bbdata.js query --help` | "Available templates" section lists **all 22** shipped query templates (21 pre-F1.1 + `pitcher-rolling-trend`), generated dynamically from the registry. | ✓ |
| H.7 | C | `node dist/bin/bbdata.js report --help` | "Available templates" marks the 8 scaffold ids with `*` and carries the legend explaining that they fetch nothing (P5.2). The 5 unmarked ids are the data-driven ones. | ✓ |

---

## §2 — Query templates (22)

One row per template. Sanity check: the template is registered, accepts the course-advertised flags, and returns a well-formed `{data, meta}` envelope with `meta.source === 'stdin'` (no live-network required for the C rows).

The **C-test command** uses `--data test/fixtures/savant-csv-sample.csv` where the template accepts pitch-level input, and `--format json` throughout. For `PlayerStats`-shaped templates (`leaderboard-*`, `*-season-profile`, `matchup-situational`, `trend-year-over-year`), stdin smoke isn't meaningful — flag those as **A** rows requiring live network.

### 2A — Pitch-level templates (Savant CSV fixture is valid input)

| # | Who | Template | C-test command | Expected | ✓ |
|---|---|---|---|---|---|
| Q.1 | C | `pitcher-arsenal` | `node dist/bin/bbdata.js query pitcher-arsenal --player "Burnes Corbin" --data test/fixtures/savant-csv-sample.csv --format json` | Exit 0. `meta.source === "stdin"`. `data` is an array with `Pitch Type`, `Usage %`, `Avg Velo` columns. | ✓ |
| Q.2 | C | `pitcher-velocity-trend` | same, template swapped | Exit 0. `data` has `Month`, `Avg Velo` columns. **Regression guard** for the placement fix — sparse input now errors instead of silently returning `[]`. | ✓ |
| Q.3 | C | `pitcher-handedness-splits` | same | Exit 0. `data.length <= 2` (one row per pitcher handedness). | ✓ |
| Q.4 | C | `pitcher-raw-pitches` | same | Exit 0. `data` is pitch-level (one row per pitch in the fixture). | ✓ |
| Q.5 | C | `pitcher-recent-form` | same | Exit 0. `data` is game-level. | ✓ |
| Q.6 | C | `pitcher-by-count` | same | Exit 0. `data` has count-state rows (e.g., `0-0`, `1-2`). | ✓ |
| Q.7 | C | `pitcher-tto` | same | Exit 0. `data` has times-through-order rows. | ✓ |
| Q.8 | C | `hitter-vs-pitch-type` | `--player "Judge Aaron" --min-pitches 1` (course says "Shohei Ohtani"; fixture is pitcher-side, so we accept any name that resolves to a `batter_*` field in the fixture; `--min-pitches 1` because every fixture group is below the default 20-pitch floor from P3.5) | Exit 0. `data` has per-pitch-type rows. | ✓ |
| Q.9 | C | `hitter-hot-cold-zones` | same | Exit 0. `data` has 9 zone rows. | ✓ |
| Q.10 | C | `hitter-handedness-splits` | same | Exit 0. `data.length <= 2`. | ✓ |
| Q.11 | C | `hitter-batted-ball` | same | Exit 0. `data` has batted-ball outcome rows. | ✓ |
| Q.12 | C | `hitter-raw-bip` | same | Exit 0. `data` is BIP-level. | ✓ |
| Q.13 | C | `hitter-zone-grid` | same | Exit 0. `data` has 9 zone rows (distinct from hot-cold-zones format). | ✓ |
| Q.14 | C | `matchup-pitcher-vs-hitter` | `--players "Burnes Corbin,Judge Aaron"` | Exit 0. `data` has matchup rows. | ✓ |
| Q.15 | C | `matchup-situational` | `--player "Burnes Corbin"` | Exit **non-zero** with the actionable assertFields error naming `"matchup-situational"` and missing field `"stats"` — the pitch-level fixture is not valid input for this season-aggregate template (P2.7 moved it to MLB statSplits; P4.7 made this error actionable instead of a `TypeError`). Live splits shape is Q.23. | ✓ |
| Q.16 | C | `trend-rolling-average` | same | Exit 0. `data` has windowed rows **or** a single "Insufficient data" row (fixture may be too small). Either is acceptable — the assertion is exit 0. | ✓ |
| Q.22 | C | `pitcher-rolling-trend` (F1.1) | `node dist/bin/bbdata.js query pitcher-rolling-trend --player "Burnes Corbin" --data test/fixtures/savant-csv-sample.csv --format json` | Exit 0. `meta.source === "stdin"`. `data` is an array of 5-start rolling windows (or empty if fixture has fewer than 5 outings). Outings with <10 tracked pitches are filtered before windowing. | ✓ |

### 2B — Season-aggregate templates (need live network; stdin not meaningful)

| # | Who | Template | Command | Expected | ✓ |
|---|---|---|---|---|---|
| Q.17 | A | `pitcher-season-profile` | `node dist/bin/bbdata.js query pitcher-season-profile --player "Corbin Burnes" --season 2025 --format json` | Exit 0. Hits FanGraphs. `data[0].player_name` matches. Flakes on FG 500s — retry once. | ✓ |
| Q.18 | A | `hitter-season-profile` | `... --player "Aaron Judge" ...` | Exit 0. | ✓ |
| Q.19 | A | `leaderboard-custom` | `... leaderboard-custom --stat ERA --min-ip 50 --top 10 --format table` | Exit 0. Table has 10 rows sorted by ERA ascending. | ✓ |
| Q.20 | A | `leaderboard-comparison` | `... leaderboard-comparison --players "Aaron Judge,Juan Soto,Mookie Betts" --format table` | Exit 0. Comparison table with 3 player columns. | ✓ |
| Q.21 | A | `trend-year-over-year` | `... trend-year-over-year --player "Shohei Ohtani" --seasons 2023-2025 --format table` | Exit 0. Metric/Prior/Current/Change table comparing the two most recent seasons in range (P1.9 shape — not per-year rows), with `⚠` flags on >10% relative moves. Pitchers need `--stat pitching`; a pitcher queried in default batting mode exits non-zero with the "re-run with `--stat pitching`" hint. | ✓ |
| Q.23 | A | `matchup-situational` (P2.7 splits) | `... matchup-situational --player "Freddie Freeman" --season 2025 --format table` | Exit 0. Hits MLB Stats API. 7 rows: `Overall`, `Scoring Position`, `Scoring Position - 2 Outs`, `Bases Empty`, `Late / Close`, `Innings One to Six`, `Seventh or Later`. | ✓ |

---

## §3 — Report templates (13)

Course quick-start commands lifted directly from `Resources/bbdata User Guide.md:193–208` and each report's `examples` field in `registry.ts`. All are A-rows: reports need data + template rendering, and meaningful output requires either live network or a precisely-shaped stdin payload per template's `dataRequirements`.

C-rows: smoke that the template is **registered** and renders without fetching anything by using `--data` + `--no-strict` (so missing sub-queries degrade gracefully to stub sections instead of erroring).

| # | Who | Template | Smoke command (C) | Expected | ✓ |
|---|---|---|---|---|---|
| R.1 | C | `pro-pitcher-eval` | `... report pro-pitcher-eval --player "Burnes Corbin" --data test/fixtures/savant-csv-sample.csv --no-strict --format markdown` | Exit 0. Markdown output contains `Pitch Arsenal`, `Splits Analysis` headings + footer version line (from the recent partial-wiring fix). | ✓ |
| R.2 | C | `pro-hitter-eval` | same shape, substitute template | Exit 0. Contains `Batted Ball Profile`, `Approach & Discipline`. | ✓ |
| R.3 | C | `relief-pitcher-quick` | same | Exit 0. Contains `Arsenal`, `Key Metrics`, `Recommendation`. | ✓ |
| R.4 | C | `college-pitcher-draft` | same | Exit 0. Contains `Arsenal Grades`, `Projection`. | ✓ |
| R.5 | C | `college-hitter-draft` | same | Exit 0. Contains `Tool Grades`, `Projection`. | ✓ |
| R.6 | C | `hs-prospect` | same | Exit 0. Contains `Makeup`, `Signability`. | ✓ |
| R.7 | C | `advance-sp` | `... report advance-sp --player "Burnes Corbin" --data test/fixtures/savant-csv-sample.csv --audience coach --no-strict` | Exit 0. Contains `Recent Form`, `Times Through the Order` (the template's actual heading — match on the full phrase or case-insensitive `Times Through`), `Platoon Vulnerabilities`, `How to Attack`. | ✓ |
| R.8 | C | `advance-lineup` | `... report advance-lineup --team NYY --no-strict` | Exit 0 OR fails cleanly with "team data not available" — `advance-lineup` has no stdin path. Accept either; record which. | ✓ |
| R.9 | C | `dev-progress` | `... report dev-progress --player "Any Name" --no-strict` | Exit 0. Stub sections present. | ✓ |
| R.10 | C | `post-promotion` | same | Exit 0. | ✓ |
| R.11 | C | `trade-target-onepager` | `... trade-target-onepager --player "Burnes Corbin" --data test/fixtures/savant-csv-sample.csv --audience gm --no-strict` | Exit 0. Contains `Strengths`, `Concerns`, `Fit Assessment`. | ✓ |
| R.12 | C | `draft-board-card` | `... draft-board-card --player "Some Prospect" --no-strict` | Exit 0. Contains `Tool Grades`, `Round Range`. | ✓ |
| R.13 | C | `draft-board-card-pitcher` | same template swapped | Exit 0. Contains Fastball/Breaking/Changeup/Command tool grades (pitcher variant). | ✓ |

### 3A — `--audience` value coverage

| # | Who | Command | Expected | ✓ |
|---|---|---|---|---|
| R.A1 | C | `... report pro-pitcher-eval --player X --data test/fixtures/savant-csv-sample.csv --no-strict --audience coach --format json` | `meta.audience === "coach"`. | ✓ |
| R.A2 | C | `... --audience gm --format json` | `meta.audience === "gm"`. | ✓ |
| R.A3 | C | `... --audience scout --format json` | `meta.audience === "scout"`. | ✓ |
| R.A4 | C | `... --audience analyst --format json` | `meta.audience === "analyst"`. | ✓ |
| R.A5 | C | `... --audience frontoffice --format json` | `meta.audience === "gm"` (alias normalized). | ✓ |
| R.A6 | C | `... --audience presentation --format json` | `meta.audience === "analyst"` (alias normalized). | ✓ |
| R.A7 | C | `... --audience bogus --format json` | Exit non-zero with helpful error listing accepted values. | ✓ |

### 3B — `--validate` flag

| # | Who | Command | Expected | ✓ |
|---|---|---|---|---|
| R.V1 | C | `... report pro-pitcher-eval --player "Burnes Corbin" --data test/fixtures/savant-csv-sample.csv --validate --no-strict` | Exit 0. **Stdout** ends with `<!-- bbdata validation: passed (checks: ...) -->`. Corrected 2026-09-07: the row used to say *stderr*, but on a clean pass stderr is empty — `log.warn` only fires when there are issues, so the banner in the markdown body is the only signal. | ✓ |
| R.V2 | C | `... report pro-pitcher-eval --player "Notarealplayer Xyz" --season 2025 --validate --no-strict` | Banner reads `failed`, with a `required-data` error per missing required query (P1.13, live on 0.11.0). **Note:** this inversion only applies to a template that *has* data requirements — a scaffold like `hs-prospect` still validates `passed`, because it has no required data to miss. | ✓ |
| R.V3 | C | `... report hs-prospect --player "Some Prospect" --validate --no-strict` | Banner still reads `passed` (a warning does not fail a report), and `scaffold-template` appears in the checks list. **Stderr** carries `Validation warnings:` followed by the scaffold notice — this is what stops a green banner from implying the numbers were checked (P5.2). | ✓ |
| R.V4 | C | any `--validate` run whose only issues are warnings | Warnings print to stderr. **Regression guard** — the CLI used to gate the issue printout on `!passed`, so every warning the checklist raised was collected and then thrown away, the scaffold notice included. | ✓ |

---

## §4 — Viz chart types (7 canonical + 6 aliases)

| # | Who | Type | Command | Expected | ✓ |
|---|---|---|---|---|---|
| V.1 | C | `movement` | `... viz movement --data test/fixtures/savant-csv-sample.csv --player "Burnes Corbin" --season 2025 --format svg -o .tmp/v-movement.svg` | Exit 0. File exists, starts with `<svg`. | ✓ |
| V.2 | C | `movement-binned` | same, type swapped | Exit 0. Valid SVG. | ✓ |
| V.3 | C | `spray` | same, `--player "Judge Aaron"` | Exit 0. Valid SVG. | ✓ |
| V.4 | C | `zone` | same | Exit 0. Valid SVG. | ✓ |
| V.5 | C | `rolling` | same + `--window 5` | Exit 0. Valid SVG. | ✓ |
| V.6 | C | `pitcher-rolling` (F1.1) | `... viz pitcher-rolling --data test/fixtures/savant-csv-sample.csv --player "Burnes Corbin" --season 2025 --format svg -o .tmp/v-pitcher-rolling.svg` | Exit 0. Valid SVG. Surfaces in `bbdata viz --help` via `formatChartTypeList()` regression guard (`test/commands/viz-help.test.ts`). | ✓ |
| V.A1 | C | alias `pitching-movement` | resolves to `movement` | Exit 0. Byte-diff vs V.1 output — should match (same input, same canonical). | ✓ |
| V.A2 | C | alias `hitting-spray` | resolves to `spray` | Exit 0. Byte-diff vs V.3. | ✓ |
| V.A3 | C | alias `hitting-zones` | resolves to `zone` | Exit 0. Byte-diff vs V.4. | ✓ |
| V.A4 | C | alias `trend-rolling` | resolves to `rolling` | Exit 0. Byte-diff vs V.5. | ✓ |
| V.7 | A | `comparison` (P5.1) | `... viz comparison --players "Aaron Judge,Shohei Ohtani,Juan Soto" --season 2025 --format svg -o .tmp/cmp3.svg` | Exit 0. Valid SVG, live network (no pitch-level fixture reaches `hitter-season-profile`). All three surnames appear in the SVG text — an empty chart renders the "No comparable season data" message instead. | ✓ |
| V.A5 | C | alias `player-comparison` | resolves to `comparison` | Listed in `viz --help` under Aliases; unknown-type error names it. | ✓ |
| V.A6 | C | alias `compare` | resolves to `comparison` | Same. | ✓ |
| V.C1 | C | `--players` on a chart that can't compare | `... viz movement --data test/fixtures/savant-csv-sample.csv --players "Aaron Judge,Shohei Ohtani"` | Exit non-zero. Error says `movement` plots one player, names `comparison` as a chart that compares, and shows the corrected command. | ✓ |
| V.C2 | C | comparison of one | `... viz comparison --player "Aaron Judge" --season 2025` | Exit non-zero: "plots two or more players", naming the one player given. **Regression guard** — before the fix this exited 0 with an empty "No comparable season data" chart for a player who has data, because rows are tagged with the player field only on a multi-name roster. | ✓ |
| V.C3 | C | comparison with no players | `... viz comparison --season 2025` | Exit non-zero, same "two or more players" error. | ✓ |
| V.F1 | C | canonical list emitted on unknown type | `... viz bogus-type --player X` | Exit non-zero. Stderr lists canonical types + aliases (13 names as of 0.12). | ✓ |

### 4A — `--format` output formats

| # | Who | Command | Expected | ✓ |
|---|---|---|---|---|
| V.F.svg | C | `V.1` command above | `.svg` file starts with `<svg`. | ✓ |
| V.F.png | C | V.1 with `--format png -o .tmp/v.png` | `.png` file starts with PNG magic bytes (89 50 4E 47). | ✓ |
| V.F.html | C | V.1 with `--format html -o .tmp/v.html` | File starts with `<!doctype html>`. Contains inline `<svg>` + `<script type="application/json" id="bbdata-spec">`. | ✓ |
| V.F.pdf | C | V.1 with `--format pdf -o .tmp/v.pdf` | File starts with `%PDF-`. | ✓ |
| V.F.pdf-raster | C | V.1 with `--format pdf --pdf-mode raster --dpi 300 -o .tmp/v-raster.pdf` | File starts with `%PDF-`. File size noticeably larger than V.F.pdf. | ✓ |
| V.F.gif | C | V.1 with `--format gif` | Exit non-zero. Stderr names accepted formats. | ✓ |
| V.F.cmp | A | `... viz comparison --players "Aaron Judge,Juan Soto" --season 2025 --format <fmt>` for svg, png, html, pdf | Exit 0 in all four. The comparison chart is faceted (one panel per metric), so it exercises a wider Vega layout than V.1 through the same four writers. | ✓ |

### 4B — Viz `--audience` normalization

| # | Who | Command | Expected | ✓ |
|---|---|---|---|---|
| V.A.gm | C | `V.1 + --audience gm` | Exit 0. Render completes. (`gm` → `frontoffice` on viz.) | ✓ |
| V.A.scout | C | `V.1 + --audience scout` | Exit 0. (`scout` → `analyst` on viz.) | ✓ |
| V.A.bogus | C | `V.1 + --audience bogus` | Exit **non-zero** listing the viz vocabulary (`coach, analyst, frontoffice, presentation` + `gm`/`scout` aliases) — P4.8 strict rejection, mirroring R.A7 on report. | ✓ |

### 4C — AI-prompt-only viz types (course-side, not CLI)

The course's `.claude/skills/viz/SKILL.md` names 8 viz templates that are explicitly **not** CLI commands — they fall through to Python/prompt generation. The test here is that the CLI **rejects** them, so students don't get a silent pass on course-side-only names.

| # | Who | Command | Expected | ✓ |
|---|---|---|---|---|
| V.AI.1 | C | `... viz pitching-heatmap --player X` | Exit non-zero. Stderr lists canonical types. | ✓ |
| V.AI.2 | C | `... viz hitting-barrel --player X` | Exit non-zero. | ✓ |
| V.AI.3 | C | `... viz percentile-chart --player X` | Exit non-zero. | ✓ |
| V.AI.4 | C | `... viz comparison-table --player X` | Exit non-zero. | ✓ |
| V.AI.5 | C | `... viz team-dashboard --player X` | Exit non-zero. | ✓ |
| V.AI.6 | C | `... viz pitching-release-point --player X` | Exit non-zero. | ✓ |
| V.AI.7 | C | `... viz pitching-mix-by-count --player X` | Exit non-zero. | ✓ |
| V.AI.8 | C | `... viz hitting-swing-decision --player X` | Exit non-zero. | ✓ |

---

## §5 — Flag matrix

Each row: one flag, one command, course citation + CLI confirmation.

| # | Who | Flag | Command | Course cites | CLI accepts? | Test command | Expected | ✓ |
|---|---|---|---|---|---|---|---|---|
| F.1 | C | `--player` / `-p` | query, report, viz | SKILL:60 | Yes | (covered by §2–§4) | — | ✓ |
| F.2 | C | `--players` | query, viz | SKILL:66 | Yes | Q.14, Q.20 | — | ✓ |
| F.3 | C | `--season` / `-s` | query, report, viz | User Guide:113 | Yes | (covered) | — | ✓ |
| F.4 | C | `--seasons <range>` | query (trend-year-over-year) | SKILL:69 | Yes | Q.21 | — | ✓ |
| F.5 | C | `--format json` | query, report | SKILL:57 | Yes | (covered) | — | ✓ |
| F.6 | C | `--format table` | query | QTL:69 | Yes | Q.19 (table output visible) | — | ✓ |
| F.7 | C | `--format csv` | query | User Guide:128 | Yes | `... query pitcher-arsenal --player "Burnes Corbin" --data test/fixtures/savant-csv-sample.csv --format csv` | Exit 0. Output starts with a header row + comma-separated values. | ✓ |
| F.8 | C | `--format markdown` | query, report | User Guide:122 | Yes | (report covered) | — | ✓ |
| F.9 | C | `--format svg/png/html/pdf` | viz | User Guide:264–279 | Yes | §4A | — | ✓ |
| F.10 | C | `--audience` | report, viz | SKILL:50 | Yes | §3A, §4B | — | ✓ |
| F.11 | C | `--stat` | query (leaderboard) | SKILL:68 | Yes | Q.19 | — | ✓ |
| F.12 | C | `--pitch-type` | query | SKILL:68 | Yes | `... query pitcher-arsenal --player "Burnes Corbin" --data test/fixtures/savant-csv-sample.csv --pitch-type FF --format json` | Exit 0. `data` has exactly one row with `Pitch Type: Four-Seam Fastball`. (G.7 fixed — stdin adapter now honors the filter.) | ✓ |
| F.13 | A | `--min-ip` | query (leaderboard) | SKILL:68 | Yes | Q.19 covers | — | ✓ |
| F.14 | A | `--min-pa` | query (leaderboard) | User Guide:99 | Yes | `... query leaderboard-custom --stat OPS --min-pa 200 --top 10` | Exit 0. | ✓ |
| F.15 | A | `--top <n>` | query (leaderboard) | SKILL:68 | Yes | Q.19 covers | — | ✓ |
| F.16 | A | `--source savant` | query, viz | SKILL:70 | Yes | `... query pitcher-arsenal --player "Corbin Burnes" --season 2025 --source savant` | Exit 0. `meta.source === "savant"`. | ✓ |
| F.17 | A | `--source fangraphs` | query | User Guide:256 | Yes | `... query pitcher-season-profile --player "Corbin Burnes" --season 2025 --source fangraphs --format json` | Exit 0. `meta.source === "fangraphs"`, 11 rows. **Corrected 2026-09-07:** the row used to reuse `pitcher-arsenal`, which is pitch-level and only Savant serves — forcing a season-level source there fails with a required-fields error, correctly. Test the flag on a season-level template. | ✓ |
| F.18 | A | `--source mlb-stats-api` | query | User Guide:256 | Yes | same as F.17, swap source | Exit 0. `meta.source === "mlb-stats-api"`, 11 rows. | ✓ |
| F.19 | C | `--source baseball-reference` | — **course never uses** | — | Yes (CLI allows) | `... --source baseball-reference` | Exit non-zero with "no adapter for baseball-reference" OR exit 0 with `meta.source === "baseball-reference"` OR exit 1 with the R2.1 config-gate error pointing at `~/.bbdata/config.json → sources.baseballReference.enabled = true` (correct behavior since v0.9.0). Record which. (Potentially dead code.) | ✓ |
| F.20 | C | `--validate` | report | SKILL:50 | Yes | R.V1 | — | ✓ |
| F.21 | C | `--no-strict` | report | — **not in course** | Yes (CLI only) | R.1–R.13 use it | — | ✓ |
| F.22 | C | `--colorblind` | viz | SKILL:63 | Yes | `V.1 + --colorblind` | Exit 0. SVG source contains viridis scheme colors — Vega-Lite emits them as `rgb(…)` triplets (e.g. `rgb(59, 82, 139)`, `rgb(33, 145, 141)`), not `#440154`-style hex, so assert on `rgb(` forms. | ✓ |
| F.23 | C | `--size WxH` | viz | SKILL:64 | Yes | `V.1 + --size 1200x800` | Exit 0. **Corrected 2026-09-07:** the SVG reports `width="1342"`, not 1200 — `--size` sets the Vega **plot area**, and axes, labels and legend lay out around it. Not a defect; the flag's help text now says so. Assert the plot grows, not an exact canvas width. | ✓ |
| F.24 | C | `--dpi <n>` | viz | User Guide:276 | Yes | `V.F.png + --dpi 300 -o .tmp/v-300.png` | File's PNG header reports pixel width ≈ chartWidth × 300/96. | ✓ |
| F.25 | C | `--pdf-mode <mode>` | viz | User Guide:252 | Yes | V.F.pdf-raster | — | ✓ |
| F.26 | C | `--window <n>` | viz (rolling) | SKILL:461 | Yes | V.5 | — | ✓ |
| F.27 | C | `-o / --output <path>` | viz | SKILL:65 | Yes | §4 all rows | — | ✓ |
| F.28 | C | `--no-cache` | query | User Guide:294 | Yes | `... query ... --no-cache` (second invocation after a cached run) | Exit 0. `meta.cached === false`. | ✓ |
| F.29 | C | `--stdin` | query, report, viz | User Guide:296 | Yes | `type test\fixtures\savant-csv-sample.csv | node dist/bin/bbdata.js query pitcher-arsenal --stdin --format json` — note: CSV pipe may not parse; prefer `--data` (see §6). | Exit 0 or a clear parse error. | ✓ |
| F.30 | C | `--data <path>` | query, report, viz | — **CLI-only (not in course yet — P3.4)** | Yes | (covered by §2A, §3, §4) | — | ✓ |
| F.31 | C | `-t / --team` | report | User Guide:340 | Yes | R.8 | — | ✓ |
| F.32 | C | `--min-pitches <n>` | query (hitter-vs-pitch-type) | — **CLI-only (P3.5; course prompt says "at least 20 pitches faced")** | Yes | `... query hitter-vs-pitch-type --player "Judge Aaron" --data test/fixtures/savant-csv-sample.csv --min-pitches 1 --format json` | Exit 0 with per-pitch-type rows. Without the flag the 13-pitch fixture filters to 0 rows (default floor is 20) and exits non-zero — that is expected, not a failure. | ✓ |

---

## §6 — Known gaps surfaced while building this plan

These are things the audit **didn't** catch and that still matter. Each should either get fixed or captured in TASKS.md.

| # | Gap | Surface | Impact | Fix direction |
|---|---|---|---|---|
| G.1 | ~~`bbdata query --help` lists only 12 templates under "Available templates" section but 21 are registered.~~ | `src/commands/query.ts` help string. | ~~Students discovering templates via `--help` miss the 9 bonus templates.~~ | **Shipped.** `formatTemplateList()` now enumerates from the registry at help-text-render time. Regression test: `test/commands/query-help.test.ts`. |
| G.2 | `TEST_PLAN.md v0.9.0` references `fixtures/burnes-2025.json` which doesn't exist in the repo. | `TEST_PLAN.md:59–69, 103`. | A-rows Aaron was meant to run are un-runnable as written — he'd hit ENOENT. | Either commit a fixture or rewrite those rows to use `test/fixtures/savant-csv-sample.csv`. S effort. |
| G.3 | `--source baseball-reference` is accepted by the query flag parser but no adapter with that name appears to be registered. | `src/cli.ts` flag help lists `baseball-reference`; no adapter file. | Silent failure mode for anyone copy-pasting the flag. | F.19 test resolves this — either implement the adapter or drop the value from the help string. S effort if dropping. |
| G.4 | Report's `--format pdf` — course's `Resources/bbdata User Guide.md:336` reference card implies PDF on viz *and* report; CLI report only accepts `markdown, json`. | `src/commands/report.ts`. | Students trying `bbdata report ... --format pdf` get a confusing error. | Either add PDF support to report (rendering markdown-to-PDF is non-trivial) or clarify the reference card to scope PDF to viz only. S–M effort. |
| G.5 | ~~Audience normalization only happens on report.~~ Since P4.8 both `report` (`src/commands/report.ts:29–47`) and `viz` (`src/viz/types.ts::resolveVizAudience`) normalize the six-value vocabulary **and reject unknown values** with an accepted-values error (R.A7 / V.A.bogus). | `src/commands/report.ts`, `src/viz/types.ts`. | Remaining gap is course-side only: the audience-mapping table still isn't in the skills. | Documentation fix: add the audience-mapping table to both skills (audit rec #10 — still open). | 
| G.6 | `--stdin` with a piped CSV through pwsh's native pipeline corrupts text (known from `reference_pwsh_binary_stdout` memory). | pwsh shell quirk, not CLI. | v0.7.2 TEST_PLAN C.1e already notes this. | Document as "use `cmd /c` for piped CSV" in `bbdata User Guide.md` troubleshooting. S effort. |
| G.7 | ~~`--pitch-type <type>` is only honored by network adapters (savant/fangraphs). The stdin/`--data` path bypasses the filter.~~ | `src/adapters/stdin.ts`. | ~~Student copy-pastes filter + fixture for iteration, sees unfiltered output, thinks flag is broken.~~ | **Shipped.** `StdinAdapter.fetch()` now applies `query.pitch_type` to pitch-level records; no-op on season-aggregate `PlayerStats`. Regression tests: `test/adapters/stdin.test.ts`. |

---

## §7 — Install / setup claims

Course makes three install claims in `bbdata User Guide.md`.

| # | Who | Claim | Test | Expected | ✓ |
|---|---|---|---|---|---|
| I.1 | A | `npm install -g bbdata` | Run in clean env: `npm install -g bbdata && bbdata --version` | Installs. `bbdata --version` prints the published version. | ☐ |
| I.2 | A | `npx bbdata <command>` | `npx bbdata query pitcher-arsenal --player "Corbin Burnes"` in a clean env | Exit 0. First run downloads package; subsequent runs cache. | ☐ |
| I.3 | A | Node.js 18+ requirement | `node --version` on a Node 16 env, then install | Install fails or runtime errors. (Not worth running unless someone's on old Node.) | ☐ |
| I.4 | A | `~/.bbdata/config.json` is read | Place `{ "cache": { "enabled": false } }` there, run any query, verify `meta.cached === false`. | Config applied. | ☐ |
| I.5 | A | `~/.bbdata/templates/reports/` overrides bundled templates | Place a modified `.hbs` there, run the matching `bbdata report`, see the modified output. | User override wins. | ☐ |

---

## §8 — Cross-project (course → CLI)

Skills in `ai-baseball-data-analyst/.claude/skills/` drive student behavior. The canonical test: can a student follow the skill's instructions and get a working result?

| # | Who | Check | Expected | ✓ |
|---|---|---|---|---|
| X.1 | A | In Claude Code inside the course folder, invoke `/query-data pitcher-arsenal Corbin Burnes 2025` | Skill generates + runs the correct `bbdata query` command. Output renders. | ☐ |
| X.2 | A | In the course folder, invoke `/scout-report advance-sp "Gerrit Cole" coach` | Skill generates + runs the correct `bbdata report` command with `--validate`. Output renders. | ☐ |
| X.3 | A | In the course folder, invoke `/viz movement "Corbin Burnes" 2025` | Skill generates + runs the correct `bbdata viz` command. SVG written. | ☐ |
| X.4 | A | Skill output quality — does `/scout-report` produce content that reads like a real scouting report? | Subjective; worth running through 2–3 reports before every CLI minor bump. | ☐ |

---

## Template for future versions

When adding a new command / flag / template, add the corresponding rows here too — **before** shipping, not after. The pattern:

1. Section headers match §1–§8 above.
2. Row id format: `<section-letter>.<number>` with sub-letters for flag variants.
3. **Who** is either `C` (Claude can run, structural check) or `A` (needs Aaron — perceptual, live-network, interactive).
4. Rows cite the **course** file:line they're validating, so a course edit that renames or removes the claim prompts a test-plan update.
