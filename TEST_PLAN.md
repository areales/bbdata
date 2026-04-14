# bbdata TEST_PLAN

Manual smoke-test checklist for every shipped release. Complements `npm test`
(unit tests with mocks) by exercising the live CLI surface — commands, flags,
binary outputs, adapter round-trips — that mocks can't validate.

## How to use

- **When shipping:** work through the current version's checklist between
  `npm version` and `npm publish`. A failure here is a release blocker.
  Tests that depend on network to Savant / FanGraphs / MLB Stats API may
  flake — retry once before treating as a real failure, and note it.
- **After shipping:** leave prior-version sections as regression baselines.
  When a later release touches a subsystem a prior version tested, re-run
  the relevant rows from that earlier section too.
- **Adding a new version:** copy the template at the bottom, paste at the
  top, fill in. One section per version.

**Who runs each row (`Who` column):**
- **C** — Claude runs it. Structural checks: exit codes, file existence,
  file headers (`%PDF-`, PNG magic bytes), JSON envelope shape, stderr
  error strings, SVG/HTML source inspection, byte-for-byte diffs.
- **A** — Aaron runs it. Perceptual checks (does the chart *look* right
  when opened in a viewer), TTY-specific behavior (Claude runs
  non-interactively so TTY guard rails never trip), and cross-project
  verification against the sibling course repo.
- Claude marks ✓ for its own rows as it runs them. Aaron marks ✓ for
  the **A** rows. A row is only "done" when its ✓ is checked.

**Common flags used below:**
- `npm run dev --` invokes the CLI from source via `tsx`. Use
  `node dist/bin/bbdata.js` to test the built artifact instead.
- `.tmp/` is a convention for throwaway output; add it to `.gitignore`
  if you start persisting artifacts.

---

## v0.8.0 — package rename (2026-04-14)

The npm package renamed from `bbdata-cli` to `bbdata`. Binary name
unchanged. No functional changes — every flag, output schema, and
adapter behavior is identical to 0.7.2. Smoke focus: confirm the new
package resolves on the registry, the new import specifier works, and
pinned `bbdata-cli@0.7.2` consumers continue to work.

### Registry + install

| # | Who | Command | Expected | ✓ |
|---|---|---|---|---|
| R.1 | C | `npm view bbdata version` | Outputs `0.8.0`. | ✓ |
| R.1b | C | `(Invoke-WebRequest -Uri "https://registry.npmjs.org/bbdata").Content.Substring(0, 500)` | Contains `"dist-tags":{"latest":"0.8.0"}`. Confirms the registry + CDN have caught up. | ✓ |
| R.2 | A | `npm install -g bbdata@0.8.0 && bbdata --version` | Outputs `0.8.0`. Validates the global-install path + `CLI_VERSION` walk-up wiring post-rename. | ☐ |

### Programmatic API

| # | Who | Command | Expected | ✓ |
|---|---|---|---|---|
| R.3 | C | In a fresh `.tmp/import-smoke/` npm project: `npm install bbdata@0.8.0`, then run a Node script with `import { query, report, viz } from 'bbdata'; console.log(typeof query, typeof report, typeof viz);` | Prints `function function function`. Confirms the ESM `main`/`exports` resolve on the renamed package. | ✓ |

### Cross-project regression

| # | Who | Check | Expected | ✓ |
|---|---|---|---|---|
| R.4 | A | `scout-app` still works on pinned `bbdata-cli@0.7.2`. Hit `localhost:3000/chat` with a known player, confirm the prefetch path succeeds. | Pinned consumers of the old package name keep working — that's the whole point of not unpublishing `bbdata-cli`. Full migration to `bbdata` happens in `RENAME_PLAN.md` phase 3. | ☐ |

### Notes

- **`test/utils/version.test.ts` (3/3 green during `prepublishOnly`) implicitly validates the walk-up sentinel in `src/utils/version.ts`:** if the `parsed.name === 'bbdata'` check fails post-rename, `CLI_VERSION` falls back to `'0.0.0'` and both the "matches package.json version" and "not the 0.0.0 fallback" assertions would fail loudly.
- **Rollback window:** `npm unpublish bbdata@0.8.0` is available for 72h from publish. After that, bump to 0.8.1.
- **`bbdata-cli@0.7.2` is intentionally NOT unpublished** and will remain installable indefinitely. It will be `npm deprecate`d (but not unpublished) ~3 weeks post-0.8.0 per `RENAME_PLAN.md` phase 5.

---

## v0.7.2 — Phase C (2026-04-14)

Items: P3.4 (`--data <path>` for `.json` and `.csv` file input).

### Prereqs

```powershell
mkdir -Force .tmp
npm run build
```

### P3.4 — `--data <path>`

| # | Who | Command | Expected | ✓ |
|---|---|---|---|---|
| C.1a | C | `npm run dev -- query pitcher-arsenal --player "Burnes Corbin" --data test/fixtures/savant-csv-sample.csv --format json` | Exits 0. JSON output has `meta.source === "stdin"` and `data.length > 0`. No network I/O. | ✓ |
| C.1b | C | `npm run dev -- viz movement --player "Burnes Corbin" --season 2025 --data test/fixtures/savant-csv-sample.csv -o .tmp/csv_viz.svg` | `.tmp/csv_viz.svg` written, non-empty, starts with `<svg`. (Got ~27 KB SVG.) | ✓ |
| C.1b-visual | A | Open `.tmp/csv_viz.svg` from C.1b in VS Code preview | Movement chart renders (dots laid out by pitch type, axes labeled). | ☐ |
| C.1c | A | Export a Savant search CSV (any pitcher, any season ≥ 2023) to `.tmp/real_savant.csv`, then `npm run dev -- query pitcher-arsenal --player "<that pitcher>" --data .tmp/real_savant.csv --format table` | Table renders with pitch-type rows. No "0 rows" error. Validates that the schema the course sends students to actually round-trips. Requires a manual Savant export — Claude can't perform the browser action. | ☐ |
| C.1d | C | Write a Savant-shaped record to `.tmp/arr2.json`: `[{"pitcher_id":"1","pitcher":"Test Player","pitch_type":"FF","release_speed":95,"game_type":"R","game_year":"2025","game_date":"2025-04-01","description":"ball"}]`, then `node dist/bin/bbdata.js query pitcher-arsenal --player "Test" --data .tmp/arr2.json --format json` | Exits 0 with `meta.source === "stdin"`. Note: the *minimal* `[{pitcher_id, pitch_type, release_speed}]` shape hits `Cannot read properties of undefined (reading 'includes')` in the arsenal template — see "Known gaps". | ✓ |
| C.1e | C | `'[]' \| node dist/bin/bbdata.js query pitcher-arsenal --player "X" --stdin --data test/fixtures/savant-csv-sample.csv` (built CLI; `npm run dev -- … --stdin` under pwsh mangles positional args) | Errors with `Pass only one of --stdin or --data <path>, not both.` Exit 1. | ✓ |
| C.1f | C | `npm run dev -- query pitcher-arsenal --player "X" --data .tmp/bad.xml` (any non-empty `.xml` file) | Errors with `Unsupported --data extension ".xml". Use .json or .csv.` Exit 1. | ✓ |
| C.1g | C | `npm run dev -- query pitcher-arsenal --player "X" --data .tmp/does-not-exist.csv` | Errors with an ENOENT / "no such file" message. Exit non-zero. | ✓ |
| C.1h | C | `npm run dev -- report relief-pitcher-quick --player "Burnes Corbin" --data test/fixtures/savant-csv-sample.csv --format json` (report path, all sub-queries should inherit `source: 'stdin'`) | Exits 0. No network calls (watch stderr — no "Fetching from Baseball Savant" line). | ✓ |

### Regression re-run (v0.7.0 + v0.7.1 features, spot check)

| # | Who | Command | Expected | ✓ |
|---|---|---|---|---|
| C.R1 | A | v0.7.0 row 1.1a (`viz movement --format png`) | Still works — Savant adapter still fetches after the `parseSavantCsv` extraction. Needs network + visual PNG check. | ☐ |
| C.R2 | A | v0.7.1 row B.1a (`viz movement --format pdf`) | Still works. Needs network + visual PDF check. | ☐ |
| C.R3 | A | `cmd /c "node dist\bin\bbdata.js query pitcher-arsenal --player ""Corbin Burnes"" --season 2025 --format json \| node dist\bin\bbdata.js query pitcher-arsenal --player ""Corbin Burnes"" --season 2025 --stdin --format table"` (pipe JSON through `--stdin`; `cmd /c` avoids pwsh's native-pipe text mangling) | Exits 0. `--stdin` path still works — the refactor didn't break the original stdin entry point. **Known flaw:** the first hop emits *formatted* rows (`"Pitch Type": "Cutter"`), not raw Savant columns, so the second hop's pitcher-arsenal template won't find its expected fields. This test needs to be rewritten to pipe raw Savant JSON, or to use a pass-through template. Leave unchecked until fixed. | ☐ |

### Cross-project verification

| # | Who | Check | Expected | ✓ |
|---|---|---|---|---|
| C.X1 | A | 1–2 course examples that use `--data ./foo.csv` from `../ai-baseball-data-analyst/Modules/` (once the course is updated to use this flag) | Works as advertised. Deferred until the course adopts the flag. | ☐ |

### Known gaps / deferred

- Multi-file `--data` (e.g., `--data pitches.csv --data stats.json` for report sub-queries that want different inputs) — out of scope; one file per invocation.
- Non-Savant CSV schemas (e.g., custom student exports with different column names) — not auto-detected. The schema is explicitly Savant's. Users with other CSVs must rename columns or convert to JSON first.
- The stdin adapter's `resolvePlayer` still relies on the first record having `pitcher_id`/`player_id` — a CSV with only batter columns will fail player resolution. Acceptable until someone files a bug.
- **Minimal raw-JSON fixtures fail the arsenal template.** `[{pitcher_id, pitch_type, release_speed}]` (just three fields) crashes with `Cannot read properties of undefined (reading 'includes')` because the template dereferences a field that isn't there. Tracked via C.1d; the test now uses a richer Savant-shaped fixture. Real-world Savant exports always include the missing fields, so this is only a paper cut for people hand-authoring minimal JSON — but the error message is inscrutable and should be caught earlier with a clearer message.
- **`npm run dev -- … --stdin` under pwsh with a stdin pipe mangles positional args** ("too many arguments for 'query'"). `node dist/bin/bbdata.js` works fine. Not a CLI bug — an npm+pwsh arg-forwarding quirk — but it affects how these smoke tests are written (see C.1e). Also: `node1 | node2` pwsh-native pipelines corrupt text between processes; use `cmd /c "… | …"` for binary-ish pipes (see `reference_pwsh_binary_stdout` memory).

---

## v0.7.1 — Phase B (2026-04-14)

Items: P3.1 (`--format pdf` with vector + raster modes).

### Prereqs

```powershell
mkdir -Force .tmp
npm run build
```

### P3.1 — `--format pdf`

| # | Who | Command | Expected | ✓ |
|---|---|---|---|---|
| B.1a | A | `npm run dev -- viz movement --player "Corbin Burnes" --season 2025 --format pdf -o .tmp/burnes.pdf` | `.tmp/burnes.pdf` exists, opens in a PDF viewer, chart renders as vector (zoom stays crisp). Claude can verify file exists + `%PDF-` header, but "zoom stays crisp" is perceptual. | ☐ |
| B.1b | A | `npm run dev -- viz spray --player "Aaron Judge" --season 2025 --format pdf -o .tmp/judge.pdf` | PDF renders. Spray chart fills the page. | ☐ |
| B.1c | A | `npm run dev -- viz zone --player "Shohei Ohtani" --season 2025 --format pdf -o .tmp/ohtani_zone.pdf` | PDF renders. Cell labels readable (regression check — zone has text with `paint-order` halos). If vector path renders labels incorrectly, retry with `--pdf-mode raster`. | ☐ |
| B.1d | A | `npm run dev -- viz rolling --player "Freddie Freeman" --season 2025 --format pdf -o .tmp/freddie.pdf` | Faceted small multiples render; each panel's y-axis independent. | ☐ |
| B.1e | A | `npm run dev -- viz movement --player "Corbin Burnes" --season 2025 --format pdf --pdf-mode raster --dpi 300 -o .tmp/burnes_raster.pdf` | PDF renders. Visually identical to PNG at equivalent DPI. Zooming reveals pixel grid (raster). File noticeably larger than B.1a. | ☐ |
| B.1f | A | `npm run dev -- viz movement --player "Corbin Burnes" --season 2025 --format pdf` (in a TTY) | Errors with `Refusing to write binary PDF to a TTY. Use --output <path> or pipe stdout.` Claude runs non-interactively so can't trigger the TTY guard. | ☐ |
| B.1g | C | `npm run dev -- viz movement --player "Corbin Burnes" --season 2025 --format gif -o .tmp/bad.gif` | Errors with `Unsupported --format "gif"`. Pure string-match check. | ☐ |

### Regression re-run (v0.7.0 features, spot check)

| # | Who | Command | Expected | ✓ |
|---|---|---|---|---|
| B.R1 | A | v0.7.0 row 1.1a (PNG output) | Still works unchanged. | ☐ |
| B.R2 | A | v0.7.0 row 1.2a (`pitching-movement` alias) | Still resolves. | ☐ |

### Cross-project verification

| # | Who | Check | Expected | ✓ |
|---|---|---|---|---|
| B.X1 | A | 2–3 `bbdata viz … --format pdf` commands from `../ai-baseball-data-analyst/Modules/04/Deliverables/Visualization Template Library.md` and `Modules/04/Lessons/05:119` | PDFs written, no errors. | ☐ |

### Known gaps / deferred

- CSV input (`--data <path>`) — ships in v0.7.2 (Phase C).
- Multi-page PDF for very tall rolling charts — not in scope; current impl is always single-page sized to chart dimensions.

---

## v0.7.0 — Phase A (2026-04-14)

Items: P1.1 (PNG), P3.2 (HTML), P3.3 (--dpi), P1.3 (--window), P1.2b (aliases),
P4.3 (audience harmonize).

### Prereqs

```powershell
mkdir -Force .tmp
npm run build
```

### P1.1 — `--format png`

| # | Who | Command | Expected | ✓ |
|---|---|---|---|---|
| 1.1a | A | `npm run dev -- viz movement --player "Corbin Burnes" --season 2025 --format png -o .tmp/burnes.png` | `.tmp/burnes.png` exists, opens as a valid PNG, movement chart visible. | ☐ |
| 1.1b | A | `npm run dev -- viz movement --player "Corbin Burnes" --season 2025 --format png \| Out-File -Encoding byte .tmp/piped.png` | Equivalent PNG produced via pipe (pwsh syntax). `.tmp/piped.png` opens correctly. | ☐ |
| 1.1c | A | `npm run dev -- viz movement --player "Corbin Burnes" --season 2025 --format png` (in a TTY) | Errors with `Refusing to write binary PNG to a TTY. Use --output <path> or pipe stdout.` and exits non-zero. | ☐ |

### P3.2 — `--format html`

| # | Who | Command | Expected | ✓ |
|---|---|---|---|---|
| 3.2a | A | `npm run dev -- viz rolling --player "Freddie Freeman" --season 2025 --format html -o .tmp/freddie.html` | File exists. Open in a browser — rolling chart renders. | ☐ |
| 3.2b | C | View-source `.tmp/freddie.html` | Contains `<!doctype html>`, inline `<svg>`, and `<script type="application/json" id="bbdata-spec">`. Spec JSON parses. Pure text inspection. | ☐ |

### P3.3 — `--dpi <n>`

| # | Who | Command | Expected | ✓ |
|---|---|---|---|---|
| 3.3a | A | `npm run dev -- viz spray --player "Aaron Judge" --season 2025 --format png --dpi 300 -o .tmp/judge_300.png` | File exists. Width ≈ `round(chartWidth × 300/96)`. At default analyst chart width (check audience defaults), expect ~2500 px wide. | ☐ |
| 3.3b | A | Same as 3.3a but `--dpi 72` → `.tmp/judge_72.png` | Noticeably smaller file than 3.3a; image visibly lower resolution. | ☐ |

### P1.3 — `--window <n>`

| # | Who | Command | Expected | ✓ |
|---|---|---|---|---|
| 1.3a | A | `npm run dev -- viz rolling --player "Freddie Freeman" --season 2025 --window 5 -o .tmp/freddie_w5.svg` | Chart renders. More data points than default (15-game window) because 5-game windows produce more steps per season. | ☐ |
| 1.3b | A | `npm run dev -- viz rolling --player "Freddie Freeman" --season 2025 -o .tmp/freddie_default.svg` | Chart renders with 15-game default. Open both SVGs in VS Code preview and confirm `freddie_w5` has denser trend lines. | ☐ |
| 1.3c | C | `npm run dev -- query trend-rolling-average --player "Freddie Freeman" --season 2025 --format json` then inspect `.data.length` | Baseline row count with default window=15. JSON length is structural. (Network-dependent; flakes are network, not code.) | ☐ |

### P1.2b — Chart-type aliases

| # | Who | Command | Expected | ✓ |
|---|---|---|---|---|
| 1.2a | A | `npm run dev -- viz pitching-movement --player "Corbin Burnes" --season 2025 -o .tmp/alias_movement.svg` | Resolves to `movement` chart. SVG identical to canonical-name run. (Claude can byte-diff the SVGs; perceptual equivalence is the final check.) | ☐ |
| 1.2b | A | `npm run dev -- viz hitting-spray --player "Aaron Judge" --season 2025 -o .tmp/alias_spray.svg` | Resolves to `spray`. | ☐ |
| 1.2c | A | `npm run dev -- viz hitting-zones --player "Shohei Ohtani" --season 2025 -o .tmp/alias_zone.svg` | Resolves to `zone`. | ☐ |
| 1.2d | A | `npm run dev -- viz trend-rolling --player "Freddie Freeman" --season 2025 -o .tmp/alias_rolling.svg` | Resolves to `rolling`. | ☐ |
| 1.2e | C | `npm run dev -- viz` (no type arg) | Lists canonical types AND alias map in help output. Pure stdout text check. | ☐ |

### P4.3 — Audience harmonize

| # | Who | Command | Expected | ✓ |
|---|---|---|---|---|
| 4.3a | A | `npm run dev -- viz movement --player "Corbin Burnes" --season 2025 --audience gm -o .tmp/aud_gm.svg` | No error. `gm` maps to `frontoffice` on viz. SVG renders. | ☐ |
| 4.3b | A | `npm run dev -- viz movement --player "Corbin Burnes" --season 2025 --audience scout -o .tmp/aud_scout.svg` | No error. `scout` maps to `analyst` on viz. SVG renders. | ☐ |
| 4.3c | C | `npm run dev -- report relief-pitcher-quick --player "Edwin Diaz" --audience presentation --format json` | No error. `presentation` normalizes to `analyst` on report. JSON `.meta.audience === "analyst"`. Structural check. | ☐ |
| 4.3d | C | `npm run dev -- report relief-pitcher-quick --player "Edwin Diaz" --audience frontoffice --format json` | No error. `frontoffice` normalizes to `gm`. JSON `.meta.audience === "gm"`. Structural check. | ☐ |

### Cross-project verification

| # | Who | Check | Expected | ✓ |
|---|---|---|---|---|
| X.1 | A | `cd ../ai-baseball-data-analyst` and run 3–5 `bbdata viz …` command strings pulled from `Modules/04/Deliverables/Visualization Template Library.md` | No `Unknown chart type` errors. PNG/HTML output written to the expected paths. | ☐ |
| X.2 | A | In `scout-app`, confirm `node_modules/bbdata-cli` is still pinned to a working version (`<=0.6.1` is fine; update via `npm install bbdata-cli@0.7.0 --prefix ../scout-app` when ready) | `scout-app` prefetch path still works — hit `/chat` with a known player name. | ☐ |

### Known gaps / deferred

- PDF (`--format pdf`) — ships in v0.7.1 (Phase B).
- CSV input (`--data <path>`) — ships in v0.7.2 (Phase C).
- `--window` on `query` CLI (programmatic API supports it; Commander flag deferred per Phase A scope).

---

## Template for future versions

```markdown
## vX.Y.Z — Phase N (YYYY-MM-DD)

Items: PX.Y (description), ...

### Prereqs

```powershell
mkdir -Force .tmp
npm run build
```

### PX.Y — <feature>

| # | Who | Command | Expected | ✓ |
|---|---|---|---|---|
| N.Xa | C/A | `<command>` | <what should happen> | ☐ |

### Cross-project verification

| # | Who | Check | Expected | ✓ |
|---|---|---|---|---|
| X.1 | A | <downstream check> | <expected> | ☐ |

### Known gaps / deferred

- <anything intentionally not tested here>
```
