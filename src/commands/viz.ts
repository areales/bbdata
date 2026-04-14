import { Command } from 'commander';
import { writeFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { log } from '../utils/logger.js';
import { query as runQuery } from './query.js';
import { getStdinAdapter } from '../adapters/index.js';
import { readStdin } from '../utils/stdin.js';
import { getConfig } from '../config/config.js';
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
        player: options.player,
        season,
        format: 'json',
        ...(options.window != null ? { window: options.window } : {}),
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

  if (options.output) {
    const outputPath = resolvePath(options.output);
    if (format === 'png') {
      const rasterWidth = options.dpi ? Math.round(width * (options.dpi / 96)) : width * 2;
      const png = rasterizeSvg(svg, { width: rasterWidth });
      writeFileSync(outputPath, png);
    } else if (format === 'pdf') {
      // DPI applies only when a caller opts into the raster fallback via
      // VizOptions.pdfMode; default is the vector path where dpi is meaningless.
      const pdf = await specToPdf(svg, {
        width,
        height,
        mode: options.pdfMode ?? 'vector',
        ...(options.dpi != null ? { dpi: options.dpi } : {}),
      });
      writeFileSync(outputPath, pdf);
    } else if (format === 'html') {
      writeFileSync(outputPath, specToHtml(svg, spec, { title: resolved.title }), 'utf-8');
    } else {
      writeFileSync(outputPath, svg, 'utf-8');
    }
    log.success(`Wrote ${options.output}`);
  }

  return {
    svg,
    spec,
    meta: {
      chartType,
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
    .addHelpText('after', `
Examples:
  bbdata viz movement --player "Corbin Burnes" --season 2025 -o burnes_movement.svg
  bbdata viz spray    --player "Aaron Judge" --audience coach --format png -o judge_spray.png
  bbdata viz zone     --player "Shohei Ohtani" --colorblind --format html -o ohtani.html
  bbdata viz rolling  --player "Freddie Freeman" --window 5
  bbdata viz spray    --player "Aaron Judge" --format pdf -o judge_spray.pdf

Chart types (canonical + aliases):
  movement              — pitch movement plot (H break vs V break, per pitch type)
  movement-binned       — binned density variant of movement for compact inline use
  spray                 — spray chart (batted ball landing positions on a field)
  zone                  — 3x3 zone profile heatmap (xwOBA per plate region)
  rolling               — rolling performance trend (time-series)

Aliases:
  pitching-movement  →  movement
  hitting-spray      →  spray
  hitting-zones      →  zone
  trend-rolling      →  rolling
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
            const effectiveWidth = width ?? result.meta.width;
            const effectiveHeight = height ?? result.meta.height;
            if (format === 'png') {
              const rasterWidth = opts.dpi ? Math.round(effectiveWidth * (opts.dpi / 96)) : effectiveWidth * 2;
              const png = rasterizeSvg(result.svg, { width: rasterWidth });
              process.stdout.write(png);
            } else {
              const pdf = await specToPdf(result.svg, {
                width: effectiveWidth,
                height: effectiveHeight,
                mode: (opts.pdfMode as 'vector' | 'raster' | undefined) ?? 'vector',
                ...(Number.isFinite(opts.dpi) ? { dpi: opts.dpi } : {}),
              });
              process.stdout.write(pdf);
            }
          } else if (format === 'html') {
            log.data(specToHtml(result.svg, result.spec, { title: (result.spec as { title?: string }).title ?? `${result.meta.player} — ${result.meta.chartType}` }));
          } else {
            log.data(result.svg + '\n');
          }
        }
      } catch (error) {
        log.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
      }
    });
}
