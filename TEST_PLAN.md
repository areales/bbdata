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

**Common flags used below:**
- `npm run dev --` invokes the CLI from source via `tsx`. Use
  `node dist/bin/bbdata.js` to test the built artifact instead.
- `.tmp/` is a convention for throwaway output; add it to `.gitignore`
  if you start persisting artifacts.

---

## v0.7.2 — Phase C (2026-04-14)

Items: P3.4 (`--data <path>` for `.json` and `.csv` file input).

### Prereqs

```powershell
mkdir -Force .tmp
npm run build
```

### P3.4 — `--data <path>`

| # | Command | Expected | ✓ |
|---|---|---|---|
| C.1a | `npm run dev -- query pitcher-arsenal --player "Burnes Corbin" --data test/fixtures/savant-csv-sample.csv --format json` | Exits 0. JSON output has `meta.source === "stdin"` and `data.length > 0`. No network I/O. | ☐ |
| C.1b | `npm run dev -- viz movement --player "Burnes Corbin" --season 2025 --data test/fixtures/savant-csv-sample.csv -o .tmp/csv_viz.svg` | `.tmp/csv_viz.svg` written. Open in VS Code preview — movement chart renders. | ☐ |
| C.1c | Export a Savant search CSV (any pitcher, any season ≥ 2023) to `.tmp/real_savant.csv`, then `npm run dev -- query pitcher-arsenal --player "<that pitcher>" --data .tmp/real_savant.csv --format table` | Table renders with pitch-type rows. No "0 rows" error. Validates that the schema the course sends students to actually round-trips. | ☐ |
| C.1d | Write `[{"pitcher_id":"1","pitch_type":"FF","release_speed":95}]` to `.tmp/arr.json`, then `npm run dev -- query pitcher-arsenal --player "Test" --data .tmp/arr.json --format json` | Exits 0 with `meta.source === "stdin"`. Confirms raw-array JSON shape still works. | ☐ |
| C.1e | `npm run dev -- query pitcher-arsenal --player "X" --stdin --data test/fixtures/savant-csv-sample.csv` (with any piped stdin) | Errors with `Pass only one of --stdin or --data <path>, not both.` Exit 1. | ☐ |
| C.1f | `npm run dev -- query pitcher-arsenal --player "X" --data .tmp/bad.xml` (any non-empty `.xml` file) | Errors with `Unsupported --data extension ".xml". Use .json or .csv.` Exit 1. | ☐ |
| C.1g | `npm run dev -- query pitcher-arsenal --player "X" --data .tmp/does-not-exist.csv` | Errors with an ENOENT / "no such file" message. Exit non-zero. | ☐ |
| C.1h | `npm run dev -- report relief-pitcher-quick --player "Burnes Corbin" --data test/fixtures/savant-csv-sample.csv --format json` (report path, all sub-queries should inherit `source: 'stdin'`) | Exits 0. No network calls (watch stderr — no "Fetching from Baseball Savant" line). | ☐ |

### Regression re-run (v0.7.0 + v0.7.1 features, spot check)

| # | Command | Expected | ✓ |
|---|---|---|---|
| C.R1 | v0.7.0 row 1.1a (`viz movement --format png`) | Still works — Savant adapter still fetches after the `parseSavantCsv` extraction. | ☐ |
| C.R2 | v0.7.1 row B.1a (`viz movement --format pdf`) | Still works. | ☐ |
| C.R3 | `npm run dev -- query pitcher-arsenal --player "Corbin Burnes" --season 2025 --format json \| node dist/bin/bbdata.js query pitcher-arsenal --player "Corbin Burnes" --stdin --format table` (pipe JSON through `--stdin`) | Exits 0. `--stdin` path still works — the refactor didn't break the original stdin entry point. | ☐ |

### Cross-project verification

| # | Check | Expected | ✓ |
|---|---|---|---|
| C.X1 | 1–2 course examples that use `--data ./foo.csv` from `../ai-baseball-data-analyst/Modules/` (once the course is updated to use this flag) | Works as advertised. Deferred until the course adopts the flag. | ☐ |

### Known gaps / deferred

- Multi-file `--data` (e.g., `--data pitches.csv --data stats.json` for report sub-queries that want different inputs) — out of scope; one file per invocation.
- Non-Savant CSV schemas (e.g., custom student exports with different column names) — not auto-detected. The schema is explicitly Savant's. Users with other CSVs must rename columns or convert to JSON first.
- The stdin adapter's `resolvePlayer` still relies on the first record having `pitcher_id`/`player_id` — a CSV with only batter columns will fail player resolution. Acceptable until someone files a bug.

---

## v0.7.1 — Phase B (2026-04-14)

Items: P3.1 (`--format pdf` with vector + raster modes).

### Prereqs

```powershell
mkdir -Force .tmp
npm run build
```

### P3.1 — `--format pdf`

| # | Command | Expected | ✓ |
|---|---|---|---|
| B.1a | `npm run dev -- viz movement --player "Corbin Burnes" --season 2025 --format pdf -o .tmp/burnes.pdf` | `.tmp/burnes.pdf` exists, opens in a PDF viewer, chart renders as vector (zoom stays crisp). | ☐ |
| B.1b | `npm run dev -- viz spray --player "Aaron Judge" --season 2025 --format pdf -o .tmp/judge.pdf` | PDF renders. Spray chart fills the page. | ☐ |
| B.1c | `npm run dev -- viz zone --player "Shohei Ohtani" --season 2025 --format pdf -o .tmp/ohtani_zone.pdf` | PDF renders. Cell labels readable (regression check — zone has text with `paint-order` halos). If vector path renders labels incorrectly, retry with `--pdf-mode raster`. | ☐ |
| B.1d | `npm run dev -- viz rolling --player "Freddie Freeman" --season 2025 --format pdf -o .tmp/freddie.pdf` | Faceted small multiples render; each panel's y-axis independent. | ☐ |
| B.1e | `npm run dev -- viz movement --player "Corbin Burnes" --season 2025 --format pdf --pdf-mode raster --dpi 300 -o .tmp/burnes_raster.pdf` | PDF renders. Visually identical to PNG at equivalent DPI. Zooming reveals pixel grid (raster). File noticeably larger than B.1a. | ☐ |
| B.1f | `npm run dev -- viz movement --player "Corbin Burnes" --season 2025 --format pdf` (in a TTY) | Errors with `Refusing to write binary PDF to a TTY. Use --output <path> or pipe stdout.` | ☐ |
| B.1g | `npm run dev -- viz movement --player "Corbin Burnes" --season 2025 --format gif -o .tmp/bad.gif` | Errors with `Unsupported --format "gif"`. | ☐ |

### Regression re-run (v0.7.0 features, spot check)

| # | Command | Expected | ✓ |
|---|---|---|---|
| B.R1 | v0.7.0 row 1.1a (PNG output) | Still works unchanged. | ☐ |
| B.R2 | v0.7.0 row 1.2a (`pitching-movement` alias) | Still resolves. | ☐ |

### Cross-project verification

| # | Check | Expected | ✓ |
|---|---|---|---|
| B.X1 | 2–3 `bbdata viz … --format pdf` commands from `../ai-baseball-data-analyst/Modules/04/Deliverables/Visualization Template Library.md` and `Modules/04/Lessons/05:119` | PDFs written, no errors. | ☐ |

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

| # | Command | Expected | ✓ |
|---|---|---|---|
| 1.1a | `npm run dev -- viz movement --player "Corbin Burnes" --season 2025 --format png -o .tmp/burnes.png` | `.tmp/burnes.png` exists, opens as a valid PNG, movement chart visible | ☐ |
| 1.1b | `npm run dev -- viz movement --player "Corbin Burnes" --season 2025 --format png \| Out-File -Encoding byte .tmp/piped.png` | Equivalent PNG produced via pipe (pwsh syntax). `.tmp/piped.png` opens correctly. | ☐ |
| 1.1c | `npm run dev -- viz movement --player "Corbin Burnes" --season 2025 --format png` (in a TTY) | Errors with `Refusing to write binary PNG to a TTY. Use --output <path> or pipe stdout.` and exits non-zero. | ☐ |

### P3.2 — `--format html`

| # | Command | Expected | ✓ |
|---|---|---|---|
| 3.2a | `npm run dev -- viz rolling --player "Freddie Freeman" --season 2025 --format html -o .tmp/freddie.html` | File exists. Open in a browser — rolling chart renders. | ☐ |
| 3.2b | View-source `.tmp/freddie.html` | Contains `<!doctype html>`, inline `<svg>`, and `<script type="application/json" id="bbdata-spec">`. Spec JSON parses. | ☐ |

### P3.3 — `--dpi <n>`

| # | Command | Expected | ✓ |
|---|---|---|---|
| 3.3a | `npm run dev -- viz spray --player "Aaron Judge" --season 2025 --format png --dpi 300 -o .tmp/judge_300.png` | File exists. Width ≈ `round(chartWidth × 300/96)`. At default analyst chart width (check audience defaults), expect ~2500 px wide. | ☐ |
| 3.3b | Same as 3.3a but `--dpi 72` → `.tmp/judge_72.png` | Noticeably smaller file than 3.3a; image visibly lower resolution. | ☐ |

### P1.3 — `--window <n>`

| # | Command | Expected | ✓ |
|---|---|---|---|
| 1.3a | `npm run dev -- viz rolling --player "Freddie Freeman" --season 2025 --window 5 -o .tmp/freddie_w5.svg` | Chart renders. More data points than default (15-game window) because 5-game windows produce more steps per season. | ☐ |
| 1.3b | `npm run dev -- viz rolling --player "Freddie Freeman" --season 2025 -o .tmp/freddie_default.svg` | Chart renders with 15-game default. Open both SVGs in VS Code preview and confirm `freddie_w5` has denser trend lines. | ☐ |
| 1.3c | `npm run dev -- query trend-rolling-average --player "Freddie Freeman" --season 2025 --format json` then inspect `.data.length` | Baseline row count with default window=15. (Programmatic `--window` on query CLI deferred; verify via viz path instead.) | ☐ |

### P1.2b — Chart-type aliases

| # | Command | Expected | ✓ |
|---|---|---|---|
| 1.2a | `npm run dev -- viz pitching-movement --player "Corbin Burnes" --season 2025 -o .tmp/alias_movement.svg` | Resolves to `movement` chart. SVG identical to canonical-name run. | ☐ |
| 1.2b | `npm run dev -- viz hitting-spray --player "Aaron Judge" --season 2025 -o .tmp/alias_spray.svg` | Resolves to `spray`. | ☐ |
| 1.2c | `npm run dev -- viz hitting-zones --player "Shohei Ohtani" --season 2025 -o .tmp/alias_zone.svg` | Resolves to `zone`. | ☐ |
| 1.2d | `npm run dev -- viz trend-rolling --player "Freddie Freeman" --season 2025 -o .tmp/alias_rolling.svg` | Resolves to `rolling`. | ☐ |
| 1.2e | `npm run dev -- viz` (no type arg) | Lists canonical types AND alias map in help output. | ☐ |

### P4.3 — Audience harmonize

| # | Command | Expected | ✓ |
|---|---|---|---|
| 4.3a | `npm run dev -- viz movement --player "Corbin Burnes" --season 2025 --audience gm -o .tmp/aud_gm.svg` | No error. `gm` maps to `frontoffice` on viz. SVG renders. | ☐ |
| 4.3b | `npm run dev -- viz movement --player "Corbin Burnes" --season 2025 --audience scout -o .tmp/aud_scout.svg` | No error. `scout` maps to `analyst` on viz. SVG renders. | ☐ |
| 4.3c | `npm run dev -- report relief-pitcher-quick --player "Edwin Diaz" --audience presentation --format json` | No error. `presentation` normalizes to `analyst` on report. JSON `.meta.audience === "analyst"`. | ☐ |
| 4.3d | `npm run dev -- report relief-pitcher-quick --player "Edwin Diaz" --audience frontoffice --format json` | No error. `frontoffice` normalizes to `gm`. JSON `.meta.audience === "gm"`. | ☐ |

### Cross-project verification

| # | Check | Expected | ✓ |
|---|---|---|---|
| X.1 | `cd ../ai-baseball-data-analyst` and run 3–5 `bbdata viz …` command strings pulled from `Modules/04/Deliverables/Visualization Template Library.md` | No `Unknown chart type` errors. PNG/HTML output written to the expected paths. | ☐ |
| X.2 | In `scout-app`, confirm `node_modules/bbdata-cli` is still pinned to a working version (`<=0.6.1` is fine; update via `npm install bbdata-cli@0.7.0 --prefix ../scout-app` when ready) | `scout-app` prefetch path still works — hit `/chat` with a known player name. | ☐ |

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

| # | Command | Expected | ✓ |
|---|---|---|---|
| N.Xa | `<command>` | <what should happen> | ☐ |

### Cross-project verification

| # | Check | Expected | ✓ |
|---|---|---|---|
| X.1 | <downstream check> | <expected> | ☐ |

### Known gaps / deferred

- <anything intentionally not tested here>
```
