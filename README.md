# bbdata-cli

[![npm version](https://img.shields.io/npm/v/bbdata-cli)](https://www.npmjs.com/package/bbdata-cli)
[![node](https://img.shields.io/node/v/bbdata-cli)](https://nodejs.org)
[![license](https://img.shields.io/npm/l/bbdata-cli)](./LICENSE)

Baseball data CLI for querying stats, generating scouting reports, and building analytics pipelines — built for humans and AI agents.

## Install

```sh
# Global (CLI usage)
npm install -g bbdata-cli

# Local (programmatic API)
npm install bbdata-cli
```

Requires Node.js 18+.

## Quick Start

```sh
# Pitcher's pitch mix, velocity, spin, whiff rates
bbdata query pitcher-arsenal --player "Corbin Burnes" --format table

# Advance scouting report for a starting pitcher
bbdata report advance-sp --player "Gerrit Cole" --audience coach

# Pitch movement chart (SVG)
bbdata viz movement --player "Shohei Ohtani" -o ohtani.svg
```

## Commands

### `bbdata query [template]`

Query baseball data using pre-built templates. Returns structured data in your choice of format.

**Key options:**

| Flag | Description |
|---|---|
| `-p, --player <name>` | Player name |
| `--players <names>` | Comma-separated names (matchups/comparisons) |
| `-s, --season <year>` | Season year (default: current) |
| `-f, --format <fmt>` | `json` (default), `table`, `csv`, `markdown` |
| `--source <src>` | Force data source: `savant`, `fangraphs`, `mlb-stats-api` |
| `--no-cache` | Bypass cache |
| `--stdin` | Read pre-fetched JSON from stdin |

Run `bbdata query --help` for the full option list.

**21 templates across 5 categories:**

**Pitcher** (8) — `pitcher-arsenal`, `pitcher-velocity-trend`, `pitcher-handedness-splits`, `pitcher-raw-pitches`, `pitcher-recent-form`, `pitcher-by-count`, `pitcher-tto`, `pitcher-season-profile`

**Hitter** (7) — `hitter-batted-ball`, `hitter-vs-pitch-type`, `hitter-hot-cold-zones`, `hitter-handedness-splits`, `hitter-zone-grid`, `hitter-raw-bip`, `hitter-season-profile`

**Matchup** (2) — `matchup-pitcher-vs-hitter`, `matchup-situational`

**Leaderboard** (2) — `leaderboard-custom`, `leaderboard-comparison`

**Trend** (2) — `trend-rolling-average`, `trend-year-over-year`

```sh
bbdata query hitter-batted-ball --player "Aaron Judge" --format table
bbdata query leaderboard-custom --stat ERA --min-ip 100 --top 10 --format csv
```

### `bbdata report [template]`

Generate scouting reports rendered from Handlebars templates. Reports pull data from multiple query templates automatically.

**Key options:**

| Flag | Description |
|---|---|
| `-p, --player <name>` | Player name |
| `-a, --audience <role>` | `coach`, `gm`, `scout`, `analyst` (default: `analyst`) |
| `-f, --format <fmt>` | `markdown` (default), `json` |
| `--validate` | Run validation checklist on the report |
| `--no-strict` | Emit stub shell instead of exiting on missing data |

**13 templates across 6 categories:**

**Pro Scouting** — `pro-pitcher-eval`, `pro-hitter-eval`, `relief-pitcher-quick`

**Amateur Scouting** — `college-pitcher-draft`, `college-hitter-draft`, `hs-prospect`

**Advance** — `advance-sp`, `advance-lineup`

**Player Development** — `dev-progress`, `post-promotion`

**Executive** — `trade-target-onepager`, `draft-board-card`, `draft-board-card-pitcher`

```sh
bbdata report pro-pitcher-eval --player "Corbin Burnes"
bbdata report trade-target-onepager --player "Vladimir Guerrero Jr." --audience gm
```

### `bbdata viz [type]`

Generate data visualizations as SVG.

**Chart types:**

| Type | Description |
|---|---|
| `movement` | Pitch movement plot (horizontal break vs vertical break) |
| `movement-binned` | Binned density variant for compact inline use |
| `spray` | Batted ball spray chart |
| `zone` | 3x3 strike zone heatmap (xwOBA) |
| `rolling` | Rolling performance trend line |

**Key options:** `--colorblind` (viridis palette), `-a, --audience` (coach/analyst/frontoffice/presentation), `--size WxH`, `-o, --output <path>`

```sh
bbdata viz spray --player "Aaron Judge" --audience coach
bbdata viz zone --player "Shohei Ohtani" --colorblind
```

## Output Formats

All commands support `--format`:

- **`json`** (default) — Structured `{ data, meta }` envelope. Designed for piping to AI agents and scripts.
- **`table`** — Human-readable ASCII table.
- **`csv`** — Standard CSV.
- **`markdown`** — Markdown table.

Decorative output (progress, warnings) goes to stderr. Data goes to stdout. Every format is pipe-safe.

## Programmatic API

```ts
import { query, report, viz, getConfig, setConfig } from 'bbdata-cli';

const result = await query({
  template: 'pitcher-arsenal',
  player: 'Corbin Burnes',
  season: 2025,
  format: 'json',
});

console.log(result.data);   // Array of row objects
console.log(result.meta);   // { template, source, cached, rowCount, season }
```

All TypeScript types are exported — see `QueryOptions`, `ReportOptions`, `VizOptions`, `QueryResult`, `ReportResult`, `VizResult`, and more.

## Data Sources

The CLI tries adapters in preference order and falls back automatically:

- **Savant** — Pitch-level Statcast data (Baseball Savant CSV)
- **FanGraphs** — Season-level aggregated stats
- **MLB Stats API** — Rosters, schedules, and universal fallback for player resolution

Override with `--source savant` (or `fangraphs`, `mlb-stats-api`). Sources can be toggled in config.

## Configuration

Config lives at `~/.bbdata/config.json` (validated with Zod, graceful defaults if missing or corrupted):

```json
{
  "defaultFormat": "json",
  "defaultAudience": "analyst",
  "cache": {
    "enabled": true,
    "maxAgeDays": 30
  },
  "sources": {
    "savant": { "enabled": true },
    "fangraphs": { "enabled": true },
    "mlbStatsApi": { "enabled": true }
  }
}
```

Access programmatically with `getConfig()` / `setConfig()`.

## Caching

Query results are cached in SQLite (via sql.js/WASM — zero native dependencies). Cache keys are SHA256 hashes of `source:params`. Default expiration is 30 days, configurable via `cache.maxAgeDays`. Bypass with `--no-cache`.

If sql.js fails to initialize, the CLI continues without cache.

## Changelog

See [CHANGELOG.md](./CHANGELOG.md).

## License

[MIT](./LICENSE)
