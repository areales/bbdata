import { Command } from 'commander';
import { writeFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { log } from '../utils/logger.js';
import { query as runQuery } from './query.js';
import { getStdinAdapter } from '../adapters/index.js';
import { readStdin } from '../utils/stdin.js';
import { getConfig } from '../config/config.js';
import { getChartBuilder, listChartTypes } from '../viz/charts/index.js';
import { specToSvg } from '../viz/render.js';
import { AUDIENCE_DEFAULTS } from '../viz/audience.js';
import {
  resolveVizAudience,
  type VizOptions,
  type VizResult,
  type ChartType,
  type ResolvedVizOptions,
} from '../viz/types.js';
import type { Audience } from '../templates/reports/registry.js';

/**
 * Programmatic API — skills and agents call this directly.
 */
export async function viz(options: VizOptions): Promise<VizResult> {
  if (options.stdin) {
    const raw = await readStdin();
    getStdinAdapter().load(raw);
  }

  const config = getConfig();
  const audience = resolveVizAudience(
    options.audience ?? (config.defaultAudience as Audience),
  );
  const defaults = AUDIENCE_DEFAULTS[audience];

  const builder = getChartBuilder(options.type);
  const season = options.season ?? new Date().getFullYear();
  const player = options.player ?? 'Unknown';
  const width = options.width ?? defaults.width;
  const height = options.height ?? defaults.height;

  // Fetch rows for each data requirement via runQuery
  const rows: Record<string, Record<string, unknown>[]> = {};
  let source = 'unknown';
  for (const req of builder.dataRequirements) {
    try {
      const result = await runQuery({
        template: req.queryTemplate,
        player: options.player,
        season,
        format: 'json',
        ...(options.stdin ? { source: 'stdin' } : {}),
        ...(options.source && !options.stdin ? { source: options.source } : {}),
      });
      rows[req.queryTemplate] = result.data;
      if (result.meta.source) source = result.meta.source;
    } catch (err) {
      if (req.required) throw err;
      rows[req.queryTemplate] = [];
    }
  }

  const resolved: ResolvedVizOptions = {
    type: options.type,
    player,
    season,
    audience,
    format: options.format ?? 'svg',
    width,
    height,
    colorblind: options.colorblind ?? false,
    title: options.title ?? builder.defaultTitle({ player, season }),
    players: options.players,
  };

  const spec = builder.buildSpec(rows, resolved);
  const svg = await specToSvg(spec);

  if (options.output) {
    writeFileSync(resolvePath(options.output), svg, 'utf-8');
    log.success(`Wrote ${options.output}`);
  }

  return {
    svg,
    spec,
    meta: {
      chartType: options.type,
      player,
      season,
      audience,
      rowCount: Object.values(rows).reduce((a, r) => a + r.length, 0),
      source,
      width,
      height,
    },
  };
}

/**
 * CLI registration — Commander calls this.
 */
export function registerVizCommand(program: Command): void {
  program
    .command('viz [type]')
    .description('Generate data visualizations (SVG)')
    .option('--type <type>', 'Chart type: movement, spray, zone, rolling')
    .option('-p, --player <name>', 'Player name')
    .option('--players <names>', 'Comma-separated player names (for comparisons)')
    .option('-s, --season <year>', 'Season year', String(new Date().getFullYear()))
    .option(
      '-a, --audience <role>',
      'Audience: coach, analyst, frontoffice, presentation, gm, scout',
    )
    .option('-f, --format <fmt>', 'Output format (svg only in v1)', 'svg')
    .option('--size <WxH>', 'Chart dimensions, e.g. 800x600')
    .option('--colorblind', 'Use a colorblind-safe palette (viridis)')
    .option('-o, --output <path>', 'Write SVG to a file (otherwise prints to stdout)')
    .option('--source <src>', 'Force a data source (savant, fangraphs, ...)')
    .option('--stdin', 'Read pre-fetched JSON data from stdin')
    .addHelpText('after', `
Examples:
  bbdata viz movement --player "Corbin Burnes" --season 2025 -o burnes_movement.svg
  bbdata viz spray    --player "Aaron Judge" --audience coach
  bbdata viz zone     --player "Shohei Ohtani" --colorblind
  bbdata viz rolling  --player "Freddie Freeman"

Chart types:
  movement  — pitch movement plot (H break vs V break, per pitch type)
  spray     — spray chart (batted ball landing positions on a field)
  zone      — 3x3 zone profile heatmap (xwOBA per plate region)
  rolling   — rolling performance trend (time-series)
`)
    .action(async (typeArg, opts) => {
      const type = (typeArg ?? opts.type) as ChartType | undefined;
      if (!type) {
        log.data('\nAvailable chart types:\n\n');
        for (const t of listChartTypes()) {
          log.data(`  ${t}\n`);
        }
        log.data('\nUsage: bbdata viz <type> --player "Name" [options]\n\n');
        return;
      }

      let width: number | undefined;
      let height: number | undefined;
      if (opts.size) {
        const [w, h] = String(opts.size).split('x').map((n: string) => parseInt(n, 10));
        if (w && h) {
          width = w;
          height = h;
        }
      }

      try {
        const result = await viz({
          type,
          player: opts.player,
          players: opts.players
            ? String(opts.players).split(',').map((s: string) => s.trim())
            : undefined,
          season: opts.season ? parseInt(opts.season) : undefined,
          audience: opts.audience,
          format: opts.format,
          width,
          height,
          colorblind: opts.colorblind,
          output: opts.output,
          source: opts.source,
          stdin: opts.stdin,
        });
        if (!opts.output) log.data(result.svg + '\n');
      } catch (error) {
        log.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
      }
    });
}
