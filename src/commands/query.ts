import { Command } from 'commander';
import { resolveAdapters, createStdinAdapter } from '../adapters/index.js';
import type { StdinAdapter } from '../adapters/stdin.js';
import type { DataSource } from '../adapters/types.js';
import { format, type OutputFormat, type FormattedOutput } from '../formatters/index.js';
import { getConfig, getConfigDir, isSourceEnabled, sourceConfigKey } from '../config/config.js';
import { log } from '../utils/logger.js';
import { readStdin } from '../utils/stdin.js';
import { loadDataFile } from '../utils/data-input.js';
import {
  getTemplate,
  listTemplates,
  type QueryTemplateParams,
  type QueryResult as TemplateQueryResult,
} from '../templates/queries/index.js';

export interface QueryOptions {
  template: string;
  player?: string;
  players?: string;
  team?: string;
  season?: number;
  stat?: string;
  pitchType?: string;
  minPa?: number;
  minIp?: number;
  top?: number;
  seasons?: string;
  /** Rolling-window size (games) — only meaningful for trend-rolling-average. */
  window?: number;
  format?: OutputFormat;
  source?: string;
  cache?: boolean;
  stdin?: boolean;
  /** Path to a local .json or .csv file to use instead of fetching. */
  data?: string;
  /**
   * Internal plumbing: a pre-loaded StdinAdapter supplied by a parent
   * command (e.g. `report()` or `viz()`) so a single stdin payload can
   * serve many sub-queries without re-reading stdin (which can only be
   * consumed once per process). Skills and agents calling `query()`
   * directly typically don't set this — use `stdin` or `data` instead.
   */
  stdinAdapter?: StdinAdapter;
}

export interface QueryResult {
  data: Record<string, unknown>[];
  formatted: string;
  meta: {
    template: string;
    source: string;
    cached: boolean;
    sampleSize: number;
    season: number;
    queryTimeMs: number;
  };
}

/**
 * Programmatic API — skills and agents call this directly.
 */
export async function query(options: QueryOptions): Promise<QueryResult> {
  if (options.stdin && options.data) {
    throw new Error('Pass only one of --stdin or --data <path>, not both.');
  }
  // Build a per-invocation stdin adapter. If a parent command supplied one
  // via `options.stdinAdapter`, reuse it so sibling sub-queries share payload.
  // Otherwise, create one locally when --stdin or --data is set.
  let stdinAdapter: StdinAdapter | undefined = options.stdinAdapter;
  if (options.stdin) {
    const raw = await readStdin();
    stdinAdapter = createStdinAdapter();
    stdinAdapter.load(raw);
    options.source = 'stdin';
  } else if (options.data) {
    stdinAdapter = loadDataFile(options.data);
    options.source = 'stdin';
  } else if (stdinAdapter) {
    // Parent command already loaded an adapter; ensure source is routed to it.
    options.source = 'stdin';
  }

  const config = getConfig();
  const outputFormat = options.format ?? (config.defaultFormat as OutputFormat);

  const template = getTemplate(options.template);
  if (!template) {
    const available = listTemplates().map((t) => `  ${t.id} — ${t.description}`).join('\n');
    throw new Error(`Unknown template "${options.template}". Available templates:\n${available}`);
  }

  // Build template params from CLI options
  const params: QueryTemplateParams = {
    player: options.player,
    players: options.players?.split(',').map((s) => s.trim()),
    team: options.team,
    season: options.season ?? new Date().getFullYear(),
    stat: options.stat,
    pitchType: options.pitchType,
    minPa: options.minPa,
    minIp: options.minIp,
    top: options.top,
    seasons: options.seasons,
    window: options.window,
  };

  // Validate required params
  for (const req of template.requiredParams) {
    if (!params[req] && !(req === 'players' && params.player)) {
      throw new Error(`Template "${template.id}" requires --${req}`);
    }
  }

  // Build adapter query
  const adapterQuery = template.buildQuery(params);

  // Get adapters in preference order
  // Filter preferred sources through config so operators can disable sources
  // (e.g. a rate-limited or compliance-blocked adapter). `stdin` bypasses this
  // — it's a local data path, not a network source, and `isSourceEnabled`
  // always returns true for it.
  let preferredSources: DataSource[];
  if (options.source) {
    const requested = options.source as DataSource;
    if (!isSourceEnabled(config, requested)) {
      const key = sourceConfigKey(requested);
      throw new Error(
        `Source "${requested}" is disabled in config. Edit ${getConfigDir()}/config.json — ` +
          `set sources.${key}.enabled = true, or omit --source to fall through to enabled sources.`,
      );
    }
    preferredSources = [requested];
  } else {
    preferredSources = template.preferredSources.filter((s) => isSourceEnabled(config, s));
    if (preferredSources.length === 0) {
      const disabled = template.preferredSources.join(', ');
      throw new Error(
        `Template "${template.id}" has no enabled sources. Its preferred sources ` +
          `(${disabled}) are all disabled in ${getConfigDir()}/config.json. ` +
          `Enable at least one under sources.*.enabled, or pass --source <name>.`,
      );
    }
  }
  const adapters = resolveAdapters(
    preferredSources,
    stdinAdapter ? { stdin: stdinAdapter } : undefined,
  );

  let lastError: Error | undefined;
  let lastErrorAdapter: string | undefined;
  let result: TemplateQueryResult | undefined;
  // BBDATA-002: track which cases occurred so we can report a precise error.
  const triedAdapters: string[] = [];
  const zeroRowAdapters: string[] = [];

  const startTime = Date.now();

  // Try adapters in preference order
  for (const adapter of adapters) {
    if (!adapter.supports(adapterQuery)) continue;
    triedAdapters.push(adapter.source);

    try {
      log.info(`Querying ${adapter.source}...`);
      const adapterResult = await adapter.fetch(adapterQuery, {
        bypassCache: options.cache === false,
      });

      const rows = template.transform(adapterResult.data, params);
      const columns = template.columns(params);

      // If adapter returned data but transform produced 0 rows, try next adapter
      if (rows.length === 0) {
        log.debug(`${adapter.source} returned 0 rows. Trying next source...`);
        zeroRowAdapters.push(adapter.source);
        continue;
      }

      result = {
        rows,
        columns,
        title: template.name,
        description: template.description,
        source: adapter.source,
        cached: adapterResult.cached,
      };
      break;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      lastErrorAdapter = adapter.source;
      log.debug(`${adapter.source} failed: ${lastError.message}. Trying next source...`);
    }
  }

  if (!result) {
    // BBDATA-002: distinguish three failure modes instead of collapsing them
    // into a single misleading message.
    const paramSummary = Object.entries({
      player: params.player,
      team: params.team,
      season: params.season,
    })
      .filter(([, v]) => v != null && v !== '')
      .map(([k, v]) => `${k}=${v}`)
      .join(', ');

    if (triedAdapters.length === 0) {
      const preferred = preferredSources.join(', ');
      throw new Error(
        `No registered adapter supports query type "${template.id}" (preferred sources: ${preferred || 'none'})`,
      );
    }
    if (lastError) {
      throw new Error(
        `Adapter "${lastErrorAdapter}" threw while fetching "${template.id}" (${paramSummary}): ${lastError.message}`,
      );
    }
    throw new Error(
      `Adapter(s) [${zeroRowAdapters.join(', ')}] returned 0 rows for "${template.id}" (${paramSummary}). ` +
        `Try an earlier --season or verify the player name.`,
    );
  }

  const queryTimeMs = Date.now() - startTime;

  const output = format(result.rows, {
    source: result.source,
    cached: result.cached,
    queryTimeMs,
    season: params.season ?? new Date().getFullYear(),
    sampleSize: result.rows.length,
    template: template.id,
  }, outputFormat, { columns: result.columns });

  return {
    data: result.rows,
    formatted: output.formatted,
    meta: {
      template: template.id,
      source: result.source,
      cached: result.cached,
      sampleSize: result.rows.length,
      season: params.season ?? new Date().getFullYear(),
      queryTimeMs,
    },
  };
}

/**
 * CLI registration — Commander calls this.
 */
export function registerQueryCommand(program: Command): void {
  const cmd = program
    .command('query [template]')
    .description('Query baseball data using pre-built templates')
    .option('-p, --player <name>', 'Player name')
    .option('--players <names>', 'Comma-separated player names (for matchups/comparisons)')
    .option('-s, --season <year>', 'Season year', String(new Date().getFullYear()))
    .option('-f, --format <fmt>', 'Output: json, table, csv, markdown', 'json')
    .option('--source <src>', 'Force a data source: savant, fangraphs, mlb-stats-api')
    .option('--stat <stat>', 'Stat to query (for leaderboards)')
    .option('--pitch-type <type>', 'Filter by pitch type (e.g., FF, SL)')
    .option('--min-pa <n>', 'Minimum plate appearances', parseInt)
    .option('--min-ip <n>', 'Minimum innings pitched', parseInt)
    .option('--top <n>', 'Number of results for leaderboards', parseInt)
    .option('--seasons <range>', 'Season range (e.g., 2023-2025)')
    .option('--no-cache', 'Bypass cache')
    .option('--stdin', 'Read pre-fetched JSON data from stdin instead of fetching from APIs')
    .option('--data <path>', 'Load data from a local .json or .csv file (Savant CSV schema) instead of fetching')
    .addHelpText('after', `
Examples:
  bbdata query pitcher-arsenal --player "Corbin Burnes" --season 2025
  bbdata query hitter-batted-ball --player "Aaron Judge" --format table
  bbdata query leaderboard-custom --stat ERA --min-ip 100 --top 10
  bbdata query hitter-hot-cold-zones --player "Shohei Ohtani"

Available templates:
  Pitcher:     pitcher-arsenal, pitcher-velocity-trend, pitcher-handedness-splits
  Hitter:      hitter-batted-ball, hitter-vs-pitch-type, hitter-hot-cold-zones
  Matchup:     matchup-pitcher-vs-hitter, matchup-situational
  Leaderboard: leaderboard-custom, leaderboard-comparison
  Trend:       trend-rolling-average, trend-year-over-year
`)
    .action(async (templateId, opts) => {
      if (!templateId) {
        // List available templates
        const templates = listTemplates();
        log.data('\nAvailable query templates:\n\n');
        for (const t of templates) {
          log.data(`  ${t.id.padEnd(32)} ${t.description}\n`);
        }
        log.data('\nUsage: bbdata query <template> --player "Name" [options]\n\n');
        return;
      }

      try {
        const result = await query({
          template: templateId,
          player: opts.player,
          players: opts.players,
          team: opts.team,
          season: opts.season ? parseInt(opts.season) : undefined,
          stat: opts.stat,
          pitchType: opts.pitchType,
          minPa: opts.minPa,
          minIp: opts.minIp,
          top: opts.top,
          seasons: opts.seasons,
          format: opts.format as OutputFormat,
          source: opts.source,
          cache: opts.cache,
          stdin: opts.stdin,
          data: opts.data,
        });

        log.data(result.formatted);
      } catch (error) {
        log.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
      }
    });
}
