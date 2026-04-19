import { Command } from 'commander';
import Handlebars from 'handlebars';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getTemplatesDir } from '../config/config.js';
import { log } from '../utils/logger.js';
import { gradeLabel, formatGrade } from '../utils/grading.js';
import { pitchTypeName } from '../adapters/types.js';
import { query as runQuery } from './query.js';
import { ExecutionContext } from '../context/execution.js';
import { generateReportGraphs } from '../viz/embed.js';
import {
  getReportTemplate,
  listReportTemplates,
  type Audience,
} from '../templates/reports/registry.js';
import type { VizAudience } from '../viz/types.js';

/**
 * Harmonize the broader viz audience vocabulary onto the report's Audience
 * type. Accepts `presentation` (→ analyst) and `frontoffice` (→ gm) so that
 * a caller using either CLI gets the same result regardless of which side
 * they came in through.
 */
function resolveReportAudience(a: Audience | VizAudience | string | undefined): Audience {
  if (!a) return 'analyst';
  switch (a) {
    case 'presentation':
      return 'analyst';
    case 'frontoffice':
      return 'gm';
    case 'coach':
    case 'gm':
    case 'scout':
    case 'analyst':
      return a;
    default:
      return 'analyst';
  }
}
import { CLI_VERSION } from '../utils/version.js';

export interface ReportOptions {
  template: string;
  player?: string;
  team?: string;
  season?: number;
  audience?: Audience | VizAudience | string;
  format?: 'markdown' | 'json';
  validate?: boolean;
  stdin?: boolean;
  /** Path to a local .json or .csv file to use instead of fetching. */
  data?: string;
  /**
   * When true (default), the command throws if any data requirement marked
   * `required: true` fails, causing the CLI to exit non-zero. Set to false to
   * preserve the older lenient behavior of emitting a stub-shell report with
   * placeholders for missing data. (BBDATA-001)
   */
  strict?: boolean;
}

export interface ReportResult {
  content: string;
  formatted: string;
  validation?: ValidationResult;
  meta: {
    template: string;
    player: string;
    audience: Audience;
    season: number;
    dataSources: string[];
  };
}

export interface ValidationResult {
  passed: boolean;
  /**
   * Names of checks that ran. Always populated when validation executes, so
   * consumers can distinguish "validator passed" from "validator skipped" even
   * on clean runs where `issues` is empty. (BBDATA-008 part A)
   */
  checks: string[];
  issues: { severity: 'error' | 'warning'; message: string }[];
}

// BBDATA-008 part A: stable check identifiers. Kept terse so they can be
// embedded in markdown comments and JSON envelopes without noise.
const VALIDATION_CHECKS = [
  'section-present',
  'placeholder-free',
  'generic-phrases',
  'length',
] as const;

// Register Handlebars helpers
Handlebars.registerHelper('grade', (value: number) => formatGrade(value));
Handlebars.registerHelper('gradeLabel', (value: number) => gradeLabel(value));
Handlebars.registerHelper('pitchType', (code: string) => pitchTypeName(code));
Handlebars.registerHelper('formatStat', (value: number, decimals: number) => {
  if (value === null || value === undefined) return '—';
  return typeof decimals === 'number' ? Number(value).toFixed(decimals) : String(value);
});
Handlebars.registerHelper('compare', (value: number, leagueAvg: number) => {
  if (value === null || value === undefined) return '—';
  const diff = value - leagueAvg;
  const pct = leagueAvg !== 0 ? ((diff / leagueAvg) * 100).toFixed(1) : '0';
  return diff > 0 ? `+${pct}%` : `${pct}%`;
});
Handlebars.registerHelper('ifGt', function (this: unknown, a: number, b: number, options: any) {
  return a > b ? options.fn(this) : options.inverse(this);
});
Handlebars.registerHelper('svgOrEmpty', (svg: string) =>
  new Handlebars.SafeString(svg ?? ''),
);

// BBDATA-011: Produce a one-liner summary of fastball velocity change
// across the 1st vs 3rd+ time through the order, given a pitcher-tto
// query result array. Returns an empty string if either bucket is
// missing or has no FB velo data so the advance-sp template can fall
// back to a static placeholder via {{#if}}.
//
// Expected input shape: rows produced by src/templates/queries/pitcher-tto.ts,
// where the "Avg FB Velo" field is a formatted string like "95.2 mph"
// or "—" when the bucket has no fastballs.
Handlebars.registerHelper('ttoVeloDelta', (rows: unknown) => {
  if (!Array.isArray(rows) || rows.length < 3) return '';
  const parseVelo = (r: unknown): number | null => {
    if (!r || typeof r !== 'object') return null;
    const v = (r as Record<string, unknown>)['Avg FB Velo'];
    if (typeof v !== 'string' || v === '—') return null;
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  };
  const first = parseVelo(rows[0]);
  const third = parseVelo(rows[2]);
  if (first == null || third == null) return '';
  const delta = first - third;
  if (Math.abs(delta) < 0.1) {
    return `Fastball velo holds steady (${first.toFixed(1)} mph) through the 3rd time through — no fatigue tell.`;
  }
  if (delta > 0) {
    return `Fastball velo drops ~${delta.toFixed(1)} mph by the 3rd time through (${first.toFixed(1)} → ${third.toFixed(1)} mph) — exploit in late at-bats.`;
  }
  return `Fastball velo actually climbs ~${Math.abs(delta).toFixed(1)} mph by the 3rd time through (${first.toFixed(1)} → ${third.toFixed(1)} mph) — late-inning adrenaline, not fatigue.`;
});

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLED_TEMPLATES_DIR = join(__dirname, '..', 'templates', 'reports');

function loadTemplate(templateFile: string): string {
  // Check user overrides first
  const userDir = join(getTemplatesDir(), 'reports');
  const userPath = join(userDir, templateFile);
  if (existsSync(userPath)) {
    return readFileSync(userPath, 'utf-8');
  }

  // Fall back to bundled templates
  const bundledPath = join(BUNDLED_TEMPLATES_DIR, templateFile);
  if (existsSync(bundledPath)) {
    return readFileSync(bundledPath, 'utf-8');
  }

  // Generate a basic template structure from the template definition
  return generateFallbackTemplate(templateFile);
}

function generateFallbackTemplate(templateFile: string): string {
  // When no .hbs file exists yet, generate markdown structure from the template definition
  const templateId = templateFile.replace('.hbs', '');
  const template = getReportTemplate(templateId);

  if (!template) return '# Report\n\n{{data}}';

  const sections = template.requiredSections
    .map((s) => `## ${s}\n\n{{!-- ${s} data goes here --}}\n*Data pending*\n`)
    .join('\n');

  return `# ${template.name}\n\n**Player:** {{player}}\n**Season:** {{season}}\n**Audience:** {{audience}}\n**Generated:** {{date}}\n\n---\n\n${sections}\n\n---\n*Generated by bbdata CLI · Data sources: {{sources}}*\n`;
}

/**
 * Programmatic API — skills and agents call this directly.
 */
export async function report(options: ReportOptions): Promise<ReportResult> {
  const context = new ExecutionContext(options);
  await context.loadStdinAdapter();

  const audience = resolveReportAudience(options.audience ?? (context.config.defaultAudience as Audience));

  const template = getReportTemplate(options.template);
  if (!template) {
    const available = listReportTemplates().map((t) => `  ${t.id} — ${t.description}`).join('\n');
    throw new Error(`Unknown report template "${options.template}". Available:\n${available}`);
  }

  const season = options.season ?? new Date().getFullYear();
  const player = options.player ?? 'Unknown';
  const team = options.team ?? '';

  // Gather data from required queries
  const dataResults: Record<string, unknown> = {};
  const dataSources: string[] = [];
  // BBDATA-001: collect failures so we can exit non-zero in strict mode.
  const failedRequired: { queryTemplate: string; message: string }[] = [];

  for (const req of template.dataRequirements) {
    try {
      const result = await runQuery({
        template: req.queryTemplate,
        player: options.player,
        team: options.team,
        season,
        format: 'json',
        ...(context.stdinAdapter ? { source: 'stdin', stdinAdapter: context.stdinAdapter } : {}),
      });
      dataResults[req.queryTemplate] = result.data;
      if (!dataSources.includes(result.meta.source)) {
        dataSources.push(result.meta.source);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (req.required) {
        log.warn(`Required data "${req.queryTemplate}" failed: ${message}`);
        failedRequired.push({ queryTemplate: req.queryTemplate, message });
      }
      dataResults[req.queryTemplate] = null;
    }
  }

  // BBDATA-001: fail loudly in strict mode (default) so scripts and CI see
  // required-data failures as errors rather than silent stub-shell success.
  const strict = options.strict ?? true;
  if (strict && failedRequired.length > 0) {
    const detail = failedRequired
      .map((f) => `  - ${f.queryTemplate}: ${f.message}`)
      .join('\n');
    throw new Error(
      `Report "${template.id}" cannot be generated — ${failedRequired.length} required data query(s) failed:\n${detail}\n` +
        `Pass --no-strict to emit a stub-shell report with placeholders instead.`,
    );
  }

  // Generate any graphs this report embeds (failures degrade gracefully to '')
  const graphs = await generateReportGraphs(
    template.id,
    player,
    season,
    audience,
    context.stdinAdapter ? { stdinAdapter: context.stdinAdapter } : {},
  );

  // Load and compile Handlebars template
  const hbsSource = loadTemplate(template.templateFile);
  const compiled = Handlebars.compile(hbsSource);

  // Render
  const rawContent = compiled({
    player,
    team,
    season,
    audience,
    date: new Date().toISOString().split('T')[0],
    sources: dataSources.join(', ') || 'none',
    cliVersion: CLI_VERSION,
    data: dataResults,
    graphs,
    ...dataResults,
  });

  // Validate if requested. The validator always runs on the raw rendered
  // content (not the banner-prefixed version) so its checks aren't polluted
  // by the banner it produces.
  let validation: ValidationResult | undefined;
  if (options.validate) {
    validation = validateReport(rawContent, template.requiredSections);
  }

  // BBDATA-008 part A: when --validate is passed, prepend an HTML-comment
  // banner naming the checks that ran. Invisible when the markdown is
  // rendered, visible in raw text for diff-based validation consumers. This
  // gives a positive signal that the validator actually executed, even on
  // clean runs where `issues` is empty.
  const content = validation
    ? buildValidationBanner(validation) + rawContent
    : rawContent;

  const formatted = options.format === 'json'
    ? JSON.stringify(
        {
          content,
          // Structured query results keyed by queryTemplate id (BBDATA-014).
          // Agent consumers can read these directly instead of regex-parsing `content`.
          sections: dataResults,
          validation,
          meta: { template: template.id, player, audience, season, dataSources },
        },
        null,
        2,
      ) + '\n'
    : content + '\n';

  return {
    content,
    formatted,
    validation,
    meta: {
      template: template.id,
      player,
      audience,
      season,
      dataSources,
    },
  };
}

function validateReport(content: string, requiredSections: string[]): ValidationResult {
  const issues: ValidationResult['issues'] = [];

  // Check required sections are present (check: section-present)
  for (const section of requiredSections) {
    if (!content.includes(section)) {
      issues.push({ severity: 'warning', message: `Missing section: "${section}"` });
    }
  }

  // Check for common AI hallucination patterns (check: placeholder-free)
  if (content.includes('Data pending') || content.includes('data goes here')) {
    issues.push({ severity: 'error', message: 'Report contains placeholder text — data was not populated' });
  }

  // Check for generic language (check: generic-phrases)
  const genericPhrases = ['shows promise', 'solid player', 'good potential', 'talented athlete'];
  for (const phrase of genericPhrases) {
    if (content.toLowerCase().includes(phrase)) {
      issues.push({ severity: 'warning', message: `Generic language detected: "${phrase}" — be more specific` });
    }
  }

  // Check minimum length (check: length)
  if (content.length < 200) {
    issues.push({ severity: 'warning', message: 'Report seems too short — may be missing content' });
  }

  return {
    passed: issues.filter((i) => i.severity === 'error').length === 0,
    checks: [...VALIDATION_CHECKS],
    issues,
  };
}

/**
 * BBDATA-008 part A: build the HTML comment banner prepended to markdown
 * output when --validate is passed. Invisible when rendered, visible in raw
 * text for diff-based validation pipelines. Emitting it unconditionally on
 * every `--validate` run lets consumers distinguish "validator ran and
 * passed" from "validator skipped / not requested."
 */
function buildValidationBanner(validation: ValidationResult): string {
  const status = validation.passed
    ? `passed (checks: ${validation.checks.join(', ')})`
    : `failed (${validation.issues.length} issue${validation.issues.length === 1 ? '' : 's'}; checks: ${validation.checks.join(', ')})`;
  return `<!-- bbdata validation: ${status} -->\n`;
}

/**
 * CLI registration — Commander calls this.
 */
export function registerReportCommand(program: Command): void {
  program
    .command('report [template]')
    .description('Generate scouting reports using pre-built templates')
    .option('-p, --player <name>', 'Player name')
    .option('-t, --team <code>', 'Team abbreviation')
    .option('-s, --season <year>', 'Season year', String(new Date().getFullYear()))
    .option('-a, --audience <role>', 'Target audience: coach, gm, scout, analyst (also accepts frontoffice→gm, presentation→analyst)')
    .option('-f, --format <fmt>', 'Output: markdown, json', 'markdown')
    .option('--validate', 'Run validation checklist on the report')
    .option('--no-strict', 'Do not exit non-zero when required data queries fail (emit stub-shell output)')
    .option('--stdin', 'Read pre-fetched JSON data from stdin instead of fetching from APIs')
    .option('--data <path>', 'Load data from a local .json or .csv file (Savant CSV schema) instead of fetching')
    .addHelpText('after', `
Examples:
  bbdata report pro-pitcher-eval --player "Corbin Burnes"
  bbdata report advance-sp --player "Gerrit Cole" --audience coach --validate
  bbdata report trade-target-onepager --player "Vladimir Guerrero Jr." --audience gm

Available templates:
  Pro Scouting:    pro-pitcher-eval, pro-hitter-eval, relief-pitcher-quick
  Amateur:         college-pitcher-draft, college-hitter-draft, hs-prospect
  Advance:         advance-sp, advance-lineup
  Player Dev:      dev-progress, post-promotion
  Executive:       trade-target-onepager, draft-board-card, draft-board-card-pitcher
`)
    .action(async (templateId, opts) => {
      if (!templateId) {
        const templates = listReportTemplates();
        log.data('\nAvailable report templates:\n\n');
        for (const t of templates) {
          log.data(`  ${t.id.padEnd(28)} ${t.description}\n`);
        }
        log.data('\nUsage: bbdata report <template> --player "Name" [options]\n\n');
        return;
      }

      try {
        const result = await report({
          template: templateId,
          player: opts.player,
          team: opts.team,
          season: opts.season ? parseInt(opts.season) : undefined,
          audience: opts.audience,
          format: opts.format,
          validate: opts.validate,
          stdin: opts.stdin,
          data: opts.data,
          strict: opts.strict,
        });

        log.data(result.formatted);

        if (result.validation && !result.validation.passed) {
          log.warn('Validation issues found:');
          for (const issue of result.validation.issues) {
            const prefix = issue.severity === 'error' ? '  ✗' : '  ⚠';
            log.warn(`${prefix} ${issue.message}`);
          }
        }
      } catch (error) {
        log.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
      }
    });
}
