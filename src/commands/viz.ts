import { Command } from 'commander';
import { writeFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { ExecutionContext } from '../context/execution.js';
import { log } from '../utils/logger.js';
import { query as runQuery } from './query.js';
import {
  getChartBuilder,
  listChartTypes,
  listChartAliases,
  resolveChartType,
} from '../viz/charts/index.js';
import { specToSvg, specToHtml, specToPdf } from '../viz/render.js';
import { rasterizeSvg } from '../viz/rasterize.js';
import { AUDIENCE_DEFAULTS } from '../viz/audience.js';
import {
  resolveVizAudience,
  type VizOptions,
  type VizResult,
  type ChartType,
  type VizFormat,
  type ResolvedVizOptions,
} from '../viz/types.js';
import type { Audience } from '../templates/reports/registry.js';

const SUPPORTED_FORMATS: VizFormat[] = ['svg', 'png', 'html', 'pdf'];

async function renderVizPayload(
  svg: string,
  spec: object,
  resolved: ResolvedVizOptions,
  options: Pick<VizOptions, 'dpi' | 'pdfMode'>,
): Promise<string | Buffer> {
  switch (resolved.format) {
    case 'png': {
      const rasterWidth = options.dpi
        ? Math.round(resolved.width * (options.dpi / 96))
        : resolved.width * 2;
      return rasterizeSvg(svg, { width: rasterWidth });
    }
    case 'pdf':
      return specToPdf(svg, {
        width: resolved.width,
        height: resolved.height,
        mode: options.pdfMode ?? 'vector',
        ...(options.dpi != null ? { dpi: options.dpi } : {}),
      });
    case 'html':
      return specToHtml(svg, spec, { title: resolved.title });
    case 'svg':
    default:
      return svg;
  }
}

/**
 * Programmatic API — skills and agents call this directly.
 */
export async function viz(options: VizOptions): Promise<VizResult> {
  const context = new ExecutionContext(options);
  await context.loadStdinAdapter();

  const audience = resolveVizAudience(
    options.audience ?? (context.config.defaultAudience as Audience),
  );
  const defaults = AUDIENCE_DEFAULTS[audience];

  // Resolve alias → canonical chart type before anything else depends on it.
  // getChartBuilder throws for unknown types; we also keep the canonical id
  // on ResolvedVizOptions / meta so downstream consumers see a stable value.
  const canonicalType = resolveChartType(options.type);
  if (!canonicalType) {
    // Delegate to getChartBuilder for the error message to stay consistent
    // with other callers that don't pre-resolve.
    getChartBuilder(options.type);
  }
  const builder = getChartBuilder(options.type);
  const chartType = canonicalType ?? (options.type as ChartType);

  const season = options.season ?? new Date().getFullYear();
  const player = options.player ?? 'Unknown';
  const width = options.width ?? defaults.width;
  const height = options.height ?? defaults.height;
  const format = (options.format ?? 'svg') as VizFormat;

  if (!SUPPORTED_FORMATS.includes(format)) {
    throw new Error(
      `Unsupported --format "${format}". Supported: ${SUPPORTED_FORMATS.join(', ')}.`,
    );
  }

  // Fetch rows for each data requirement via runQuery
  const rows: Record<string, Record<string, unknown>[]> = {};
  let source = 'unknown';
  for (const req of builder.dataRequirements) {
    try {
      const result = await runQuery({
        template: req.queryTemplate,
        resolveTemplateId: req.queryTemplate,
        player: options.player,
        season,
        format: 'json',
        ...(options.window != null ? { window: options.window } : {}),
        ...(context.stdinAdapter ? { source: 'stdin', stdinAdapter: context.stdinAdapter } : {}),
        ...(options.source && !context.stdinAdapter ? { source: options.source } : {}),
      });
      rows[req.queryTemplate] = result.data;
      if (result.meta.source) source = result.meta.source;
    } catch (err) {
      if (req.required) throw err;
      rows[req.queryTemplate] = [];
    }
  }

  const resolved: ResolvedVizOptions = {
    type: chartType,
    player,
    season,
    audience,
    format,
    width,
    height,
    colorblind: options.colorblind ?? false,
    title: options.title ?? builder.defaultTitle({ player, season }),
    players: options.players,
    ...(options.window != null ? { window: options.window } : {}),
    ...(options.dpi != null ? { dpi: options.dpi } : {}),
  };

  const spec = builder.buildSpec(rows, resolved);
  const svg = await specToSvg(spec);
  const formatted = await renderVizPayload(svg, spec, resolved, options);

  if (options.output) {
    const outputPath = resolvePath(options.output);
    if (Buffer.isBuffer(formatted)) {
      writeFileSync(outputPath, formatted);
    } else {
      writeFileSync(outputPath, formatted, 'utf-8');
    }
    log.success(`Wrote ${options.output}`);
  }

  return {
    formatted,
    svg,
    spec,
    meta: {
      chartType,
      format,
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

// Generated from the live chart-builder registry so new chart types surface
// in `bbdata viz --help` automatically — mirrors the G.1 fix on query --help.
// Keyed by ChartType so the compiler forces a description update whenever a
// new chart is added to src/viz/charts/index.ts.
const CHART_TYPE_DESCRIPTIONS: Record<ChartType, string> = {
  movement:          'pitch movement plot (H break vs V break, per pitch type)',
  'movement-binned': 'binned density variant of movement for compact inline use',
  spray:             'spray chart (batted ball landing positions on a field)',
  zone:              '3x3 zone profile heatmap (xwOBA per plate region)',
  rolling:           'rolling performance trend for hitters (xwOBA, xwOBAcon)',
  'pitcher-rolling': '5-start rolling trend for pitchers (velo, Whiff %, K %, CSW %)',
};

export function formatChartTypeList(): string {
  const types = listChartTypes();
  const aliases = listChartAliases();
  const nameWidth = Math.max(...types.map((t) => t.length), ...Object.keys(aliases).map((a) => a.length));
  const typeLines = types
    .map((t) => `  ${t.padEnd(nameWidth)}  — ${CHART_TYPE_DESCRIPTIONS[t]}`)
    .join('\n');
  const aliasLines = Object.entries(aliases)
    .map(([alias, canonical]) => `  ${alias.padEnd(nameWidth)}  →  ${canonical}`)
    .join('\n');
  return `Chart types (canonical):\n${typeLines}\n\nAliases:\n${aliasLines}`;
}

/**
 * CLI registration — Commander calls this.
 */
export function registerVizCommand(program: Command): void {
  program
    .command('viz [type]')
    .description('Generate data visualizations (SVG, PNG, HTML)')
    .option('--type <type>', 'Chart type (see list below)')
    .option('-p, --player <name>', 'Player name')
    .option('--players <names>', 'Comma-separated player names (for comparisons)')
    .option('-s, --season <year>', 'Season year', String(new Date().getFullYear()))
    .option(
      '-a, --audience <role>',
      'Audience: coach, analyst, frontoffice, presentation, gm, scout',
    )
    .option('-f, --format <fmt>', 'Output format: svg, png, html, pdf', 'svg')
    .option('--dpi <n>', 'Target DPI for raster output (png, or pdf with --pdf-mode raster)', (v) => parseInt(v, 10))
    .option('--pdf-mode <mode>', 'PDF rendering: vector (default) or raster (fallback for complex Vega output)')
    .option('--window <n>', 'Rolling window size in games (rolling chart only)', (v) => parseInt(v, 10))
    .option('--size <WxH>', 'Chart dimensions, e.g. 800x600')
    .option('--colorblind', 'Use a colorblind-safe palette (viridis)')
    .option('-o, --output <path>', 'Write chart to a file (otherwise prints to stdout)')
    .option('--source <src>', 'Force a data source (savant, fangraphs, ...)')
    .option('--stdin', 'Read pre-fetched JSON data from stdin')
    .option('--data <path>', 'Load data from a local .json or .csv file (Savant CSV schema) instead of fetching')
    .addHelpText('after', () => `
Examples:
  bbdata viz movement --player "Corbin Burnes" --season 2025 -o burnes_movement.svg
  bbdata viz spray    --player "Aaron Judge" --audience coach --format png -o judge_spray.png
  bbdata viz zone     --player "Shohei Ohtani" --colorblind --format html -o ohtani.html
  bbdata viz rolling  --player "Freddie Freeman" --window 5
  bbdata viz spray    --player "Aaron Judge" --format pdf -o judge_spray.pdf

${formatChartTypeList()}
`)
    .action(async (typeArg, opts) => {
      const type = (typeArg ?? opts.type) as string | undefined;
      if (!type) {
        log.data('\nAvailable chart types:\n\n');
        for (const t of listChartTypes()) {
          log.data(`  ${t}\n`);
        }
        log.data('\nAliases:\n');
        for (const [alias, canonical] of Object.entries(listChartAliases())) {
          log.data(`  ${alias.padEnd(20)} → ${canonical}\n`);
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

      const format = (opts.format ?? 'svg') as VizFormat;

      try {
        const result = await viz({
          type,
          player: opts.player,
          players: opts.players
            ? String(opts.players).split(',').map((s: string) => s.trim())
            : undefined,
          season: opts.season ? parseInt(opts.season) : undefined,
          audience: opts.audience,
          format,
          width,
          height,
          colorblind: opts.colorblind,
          output: opts.output,
          source: opts.source,
          stdin: opts.stdin,
          data: opts.data,
          ...(Number.isFinite(opts.window) ? { window: opts.window } : {}),
          ...(Number.isFinite(opts.dpi) ? { dpi: opts.dpi } : {}),
          ...(opts.pdfMode ? { pdfMode: opts.pdfMode as 'vector' | 'raster' } : {}),
        });
        if (!opts.output) {
          if (format === 'png' || format === 'pdf') {
            // Binary to a TTY would corrupt the terminal. Refuse early with a
            // hint rather than dumping bytes.
            if (process.stdout.isTTY) {
              log.error(`Refusing to write binary ${format.toUpperCase()} to a TTY. Use --output <path> or pipe stdout.`);
              process.exitCode = 1;
              return;
            }
            process.stdout.write(result.formatted as Buffer);
          } else if (format === 'html') {
            log.data(result.formatted as string);
          } else {
            log.data((result.formatted as string) + '\n');
          }
        }
      } catch (error) {
        log.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
      }
    });
}
