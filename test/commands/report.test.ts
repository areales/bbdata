import { describe, it, expect, vi, beforeEach } from 'vitest';

// Must import report templates to register them
import '../../src/templates/reports/registry.js';

vi.mock('../../src/commands/query.js', () => ({
  query: vi.fn(),
}));

// Avoid cascading into the real vega pipeline during report tests.
vi.mock('../../src/viz/embed.js', () => ({
  generateReportGraphs: vi.fn(async () => ({})),
}));

vi.mock('../../src/utils/logger.js', () => ({
  log: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), success: vi.fn(), error: vi.fn(), data: vi.fn() },
}));

vi.mock('../../src/config/config.js', () => ({
  getConfig: vi.fn(() => ({
    defaultFormat: 'json',
    defaultAudience: 'analyst',
    cache: { enabled: true, maxAgeDays: 30, directory: '' },
    templates: { directory: '' },
    sources: {},
  })),
  getConfigDir: vi.fn(() => '/tmp/bbdata'),
  getCacheDir: vi.fn(() => '/tmp/bbdata/cache'),
  getTemplatesDir: vi.fn(() => '/tmp/bbdata/templates'),
  setConfig: vi.fn(),
}));

import { report } from '../../src/commands/report.js';
import { query as runQuery } from '../../src/commands/query.js';
import {
  getReportTemplate,
  isScaffoldTemplate,
  listReportTemplates,
} from '../../src/templates/reports/registry.js';

describe('report command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock query to return minimal data for all data requirements
    vi.mocked(runQuery).mockResolvedValue({
      data: [{ 'Pitch Type': 'FF', 'Usage %': '50%' }],
      formatted: '{}',
      meta: { template: 'pitcher-arsenal', source: 'savant', cached: false, sampleSize: 1, season: 2025, queryTimeMs: 0, cliVersion: '0.0.0-test' },
    });
  });

  it('throws for unknown template', async () => {
    await expect(
      report({ template: 'nonexistent-report' }),
    ).rejects.toThrow('Unknown report template');
  });

  it('returns report content for a valid template', async () => {
    const result = await report({
      template: 'pro-pitcher-eval',
      player: 'Corbin Burnes',
      season: 2025,
      audience: 'scout',
    });

    expect(result).toHaveProperty('content');
    expect(result).toHaveProperty('formatted');
    expect(result).toHaveProperty('meta');
    expect(result.meta.template).toBe('pro-pitcher-eval');
    expect(result.meta.player).toBe('Corbin Burnes');
    expect(result.meta.audience).toBe('scout');
  });

  it('fetches data for each data requirement', async () => {
    await report({
      template: 'pro-pitcher-eval',
      player: 'Corbin Burnes',
      season: 2025,
    });

    // pro-pitcher-eval has 4 data requirements:
    // pitcher-arsenal, pitcher-velocity-trend, pitcher-handedness-splits,
    // pitcher-season-profile (BBDATA-003)
    expect(runQuery).toHaveBeenCalledTimes(4);
  });

  it('fetches data for each pro-hitter-eval data requirement', async () => {
    await report({
      template: 'pro-hitter-eval',
      player: 'Aaron Judge',
      season: 2025,
    });

    // pro-hitter-eval has 6 data requirements:
    // hitter-batted-ball, hitter-vs-pitch-type, hitter-hot-cold-zones,
    // hitter-handedness-splits, trend-rolling-average,
    // hitter-season-profile (BBDATA-004)
    expect(runQuery).toHaveBeenCalledTimes(6);
  });

  it('advance-sp fetches all 5 data requirements including the BBDATA-011 tactical queries', async () => {
    await report({
      template: 'advance-sp',
      player: 'Gerrit Cole',
      season: 2024,
      audience: 'coach',
    });

    // pitcher-arsenal, pitcher-handedness-splits, pitcher-recent-form,
    // pitcher-by-count, pitcher-tto
    expect(runQuery).toHaveBeenCalledTimes(5);
  });

  it('advance-sp renders populated tables (not placeholders) when tactical queries succeed', async () => {
    // Return shape-accurate mock data for each query template so the
    // Handlebars template exercises its populated branch for every new
    // BBDATA-011 section.
    vi.mocked(runQuery).mockImplementation(async (opts: { template: string }) => {
      const shapes: Record<string, Record<string, unknown>[]> = {
        'pitcher-arsenal': [
          { 'Pitch Type': 'Four-Seam Fastball', 'Usage %': '48.2%', 'Avg Velo': '96.4 mph', 'Avg Spin': '2450 rpm', 'Whiff %': '24.3%' },
        ],
        'pitcher-handedness-splits': [
          { vs: 'R', PA: 420, AVG: '.218', SLG: '.362', 'K %': '28.5%', 'BB %': '7.4%' },
        ],
        'pitcher-recent-form': [
          { Date: '2024-09-25', IP: '6.2', H: 4, K: 9, 'BB/HBP': 1, Pitches: 101, 'Avg FB': '96.8 mph', 'Max Velo': '99.1 mph' },
        ],
        'pitcher-by-count': [
          { 'Count State': 'Ahead', Pitches: 800, 'Usage %': '40.0%', 'Whiff %': '30.2%', 'Primary Pitch': 'Slider', xwOBA: '0.210' },
          { 'Count State': 'Even', Pitches: 600, 'Usage %': '30.0%', 'Whiff %': '22.5%', 'Primary Pitch': 'Four-Seam Fastball', xwOBA: '0.290' },
          { 'Count State': 'Behind', Pitches: 600, 'Usage %': '30.0%', 'Whiff %': '15.0%', 'Primary Pitch': 'Four-Seam Fastball', xwOBA: '0.350' },
          { 'Count State': 'Two-strike (overlay)', Pitches: 700, 'Usage %': '35.0%', 'Whiff %': '38.4%', 'Primary Pitch': 'Slider', xwOBA: '0.190' },
        ],
        'pitcher-tto': [
          { Pass: '1st TTO', PAs: 90, 'K %': '32.0%', 'BB %': '6.0%', xwOBA: '0.280', 'Avg FB Velo': '97.2 mph' },
          { Pass: '2nd TTO', PAs: 85, 'K %': '28.5%', 'BB %': '7.0%', xwOBA: '0.310', 'Avg FB Velo': '96.5 mph' },
          { Pass: '3rd+ TTO', PAs: 40, 'K %': '21.0%', 'BB %': '9.0%', xwOBA: '0.360', 'Avg FB Velo': '95.1 mph' },
        ],
      };
      return {
        data: shapes[opts.template] ?? [],
        formatted: '{}',
        meta: { template: opts.template, source: 'savant', cached: false, sampleSize: 1, season: 2024, queryTimeMs: 0 },
      };
    });

    const result = await report({
      template: 'advance-sp',
      player: 'Gerrit Cole',
      season: 2024,
      audience: 'coach',
    });

    // The placeholder copy from the old template must NOT appear.
    expect(result.content).not.toContain('Last 5 starts — game-log data not available');
    expect(result.content).not.toContain('3rd time adjustment, velocity drop patterns');

    // Recent Form table row rendered with the mocked date
    expect(result.content).toContain('2024-09-25');
    expect(result.content).toContain('6.2'); // IP

    // By Count table rows (all 4 including the two-strike overlay)
    expect(result.content).toContain('Two-strike (overlay)');

    // TTO table rows
    expect(result.content).toContain('1st TTO');
    expect(result.content).toContain('3rd+ TTO');

    // How to Attack: the ttoVeloDelta helper should have produced a sentence
    // referencing a velocity drop (97.2 → 95.1 = ~2.1 mph drop).
    expect(result.content).toMatch(/Fastball velo drops ~2\.1 mph/);
  });

  it('validation detects placeholder text', async () => {
    // Mock query to return null data (triggers fallback template with "Data pending")
    vi.mocked(runQuery).mockResolvedValue({
      data: [],
      formatted: '{}',
      meta: { template: 'pitcher-arsenal', source: 'savant', cached: false, sampleSize: 0, season: 2025, queryTimeMs: 0 },
    });

    const result = await report({
      template: 'pro-pitcher-eval',
      player: 'Test Player',
      season: 2025,
      validate: true,
    });

    expect(result.validation).toBeDefined();
    // BBDATA-008 part A: checks array is always populated when validation runs,
    // even when issues are present.
    expect(result.validation!.checks).toContain('section-present');
    expect(result.validation!.checks.length).toBeGreaterThan(0);
    // Fallback template contains "Data pending"
    if (result.content.includes('Data pending')) {
      expect(result.validation!.passed).toBe(false);
      expect(result.validation!.issues.some((i) => i.message.includes('placeholder'))).toBe(true);
    }
  });

  it('validation emits positive signal on clean runs (BBDATA-008 part A)', async () => {
    // Ensure query returns healthy data (default beforeEach mock is good)
    const result = await report({
      template: 'relief-pitcher-quick',
      player: 'Edwin Diaz',
      season: 2025,
      validate: true,
    });

    // Structured validation is always populated when --validate is passed.
    expect(result.validation).toBeDefined();
    expect(result.validation!.checks).toEqual(
      expect.arrayContaining(['section-present', 'placeholder-free', 'generic-phrases', 'length']),
    );
    // Markdown content begins with an HTML-comment banner naming the checks
    // that ran — visible in raw text, invisible when rendered.
    expect(result.content.startsWith('<!-- bbdata validation:')).toBe(true);
    expect(result.content).toContain('section-present');
  });

  it('markdown has no validation banner when --validate is not passed', async () => {
    const result = await report({
      template: 'relief-pitcher-quick',
      player: 'Edwin Diaz',
      season: 2025,
    });

    expect(result.validation).toBeUndefined();
    expect(result.content.startsWith('<!-- bbdata validation:')).toBe(false);
  });

  it('rejects unknown --audience values with the accepted list (P4.8 regression)', async () => {
    // --audience bogus used to exit 0 and silently render analyst styling.
    await expect(
      report({
        template: 'relief-pitcher-quick',
        player: 'Edwin Diaz',
        season: 2025,
        audience: 'bogus',
      }),
    ).rejects.toThrow(/Unknown --audience "bogus".*coach, gm, scout, analyst/);
  });

  it('accepts every canonical audience and both aliases', async () => {
    for (const [input, resolved] of [
      ['coach', 'coach'],
      ['gm', 'gm'],
      ['scout', 'scout'],
      ['analyst', 'analyst'],
      ['frontoffice', 'gm'],
      ['presentation', 'analyst'],
    ] as const) {
      const result = await report({
        template: 'relief-pitcher-quick',
        player: 'Edwin Diaz',
        season: 2025,
        audience: input,
      });
      expect(result.meta.audience).toBe(resolved);
    }
  });

  it('returns JSON format when requested', async () => {
    const result = await report({
      template: 'relief-pitcher-quick',
      player: 'Edwin Diaz',
      season: 2025,
      format: 'json',
    });

    const parsed = JSON.parse(result.formatted);
    expect(parsed).toHaveProperty('content');
    expect(parsed).toHaveProperty('meta');
  });

  it('derives sub-query parameters from each data requirement paramMapping', async () => {
    const template = getReportTemplate('relief-pitcher-quick');
    expect(template).toBeDefined();
    const requirement = template!.dataRequirements[0]!;
    const original = { ...requirement.paramMapping };
    requirement.paramMapping = { player: 'team' };

    try {
      await report({
        template: 'relief-pitcher-quick',
        player: 'Edwin Diaz',
        team: 'NYM',
        season: 2025,
      });

      const firstCall = vi.mocked(runQuery).mock.calls[0]![0];
      expect(firstCall.player).toBe('NYM');
      expect(firstCall.season).toBe(2025);
    } finally {
      requirement.paramMapping = original;
    }
  });

  it('forwards --team to sub-queries even when paramMapping does not mention team', async () => {
    // Regression: paramMapping should be additive on top of the base trio
    // (player, team, season), not a replacement. A sub-query that reads
    // params.team must still see the report-level --team value when the
    // template's paramMapping only declares { player: 'player' } (which is
    // the case for every currently-registered template).
    await report({
      template: 'relief-pitcher-quick',
      player: 'Edwin Diaz',
      team: 'NYM',
      season: 2025,
    });

    const firstCall = vi.mocked(runQuery).mock.calls[0]![0];
    expect(firstCall.player).toBe('Edwin Diaz');
    expect(firstCall.team).toBe('NYM');
    expect(firstCall.season).toBe(2025);
  });

  it('propagates --team into the advance-lineup render context (BBDATA-012)', async () => {
    const result = await report({
      template: 'advance-lineup',
      team: 'LAD',
      season: 2025,
      audience: 'coach',
    });

    // H1 title should read "# Advance Report: LAD Lineup" — no double space.
    expect(result.content).toContain('# Advance Report: LAD Lineup');
    expect(result.content).not.toContain('Advance Report:  Lineup');
    // Opponent row in the header table should be populated.
    expect(result.content).toMatch(/\|\s*Opponent\s*\|\s*LAD\s*\|/);
  });

  it('advance-lineup without --team still renders without crashing', async () => {
    const result = await report({
      template: 'advance-lineup',
      season: 2025,
      audience: 'coach',
    });

    // Missing team renders as empty (same permissive behavior as missing --player).
    expect(result.content).toContain('Advance Report:');
    expect(result).toHaveProperty('meta');
  });

  it('strict mode (default) throws when a required data query fails (BBDATA-001)', async () => {
    vi.mocked(runQuery).mockRejectedValue(new Error('Adapter "savant" returned 0 rows'));

    await expect(
      report({
        template: 'pro-pitcher-eval',
        player: 'Corbin Burnes',
        season: 2026,
        audience: 'scout',
      }),
    ).rejects.toThrow(/required data query\(s\) failed/);
  });

  it('strict mode error message names the failed queries and suggests --no-strict', async () => {
    vi.mocked(runQuery).mockRejectedValue(new Error('Adapter "savant" returned 0 rows for "pitcher-arsenal"'));

    try {
      await report({
        template: 'pro-pitcher-eval',
        player: 'Corbin Burnes',
        season: 2026,
      });
      expect.fail('expected report() to throw');
    } catch (err) {
      const msg = (err as Error).message;
      expect(msg).toContain('pitcher-arsenal');
      expect(msg).toContain('--no-strict');
    }
  });

  it('strict=false preserves the legacy lenient behavior (BBDATA-001 opt-out)', async () => {
    vi.mocked(runQuery).mockRejectedValue(new Error('Adapter "savant" returned 0 rows'));

    const result = await report({
      template: 'pro-pitcher-eval',
      player: 'Corbin Burnes',
      season: 2026,
      strict: false,
    });

    // Should return a stub-shell result, not throw.
    expect(result).toHaveProperty('content');
    expect(result.meta.template).toBe('pro-pitcher-eval');
  });

  it('--no-strict --validate fails validation when required data is missing (P1.13 regression)', async () => {
    // Reproduced live 2026-08-25: five templates rendered with both
    // required queries returning 0 rows and still validated green,
    // because the .hbs per-section fallbacks never emit the placeholder
    // sentinels the placeholder-free check looks for. The required-data
    // check validates the data outcome directly.
    vi.mocked(runQuery).mockRejectedValue(new Error('Adapter "savant" returned 0 rows'));

    const result = await report({
      template: 'pro-pitcher-eval',
      player: 'Corbin Burnes',
      season: 2026,
      strict: false,
      validate: true,
    });

    expect(result.validation).toBeDefined();
    expect(result.validation!.passed).toBe(false);
    expect(result.validation!.checks).toContain('required-data');
    const dataErrors = result.validation!.issues.filter(
      (i) => i.severity === 'error' && i.message.includes('was not available'),
    );
    expect(dataErrors.length).toBeGreaterThan(0);
    // The banner reflects the failure in raw markdown too.
    expect(result.content).toContain('<!-- bbdata validation: failed');
  });

  it('--no-strict --validate still passes when all required data resolves', async () => {
    const result = await report({
      template: 'relief-pitcher-quick',
      player: 'Edwin Diaz',
      season: 2025,
      strict: false,
      validate: true,
    });

    expect(result.validation!.passed).toBe(true);
    expect(result.validation!.checks).toContain('required-data');
  });

  it('draft-board-card-pitcher renders with pitcher tool grades (BBDATA-013)', async () => {
    const result = await report({
      template: 'draft-board-card-pitcher',
      player: 'Seth Hernandez',
      audience: 'gm',
    });

    // Pitcher tool grid should have Fastball/Breaking/Changeup/Command
    expect(result.content).toContain('Fastball');
    expect(result.content).toContain('Breaking Ball');
    expect(result.content).toContain('Changeup');
    expect(result.content).toContain('Command');
    // Hitter-specific columns should NOT appear in this variant
    expect(result.content).not.toMatch(/\|\s*Hit\s*\|\s*Power\s*\|\s*Speed\s*\|/);
    expect(result.meta.template).toBe('draft-board-card-pitcher');
  });

  it('draft-board-card (hitter) remains unchanged with hitter tool grades', async () => {
    const result = await report({
      template: 'draft-board-card',
      player: 'Ethan Holliday',
      audience: 'gm',
    });

    // Original hitter tool grid is preserved — back-compat check
    expect(result.content).toMatch(/\|\s*Hit\s*\|\s*Power\s*\|\s*Speed\s*\|\s*Field\s*\|\s*Arm\s*\|/);
    expect(result.content).not.toContain('Fastball');
  });

  it('report footer embeds the CLI version from package.json (regression: footer partial was orphaned)', async () => {
    // The footer.hbs partial existed but was never registered — reports
    // rendered without any version line. Guard against re-orphaning by
    // asserting the footer's version + disclaimer text appear in output.
    const { readFileSync } = await import('node:fs');
    const pkg = JSON.parse(
      readFileSync(new URL('../../package.json', import.meta.url), 'utf-8'),
    ) as { version: string };

    const result = await report({
      template: 'trade-target-onepager',
      player: 'Vladimir Guerrero Jr.',
      season: 2026,
      audience: 'gm',
    });

    expect(result.content).toContain(`bbdata CLI v${pkg.version}`);
    expect(result.content).toContain('generated with AI assistance');
  });

  it('JSON output exposes structured sections keyed by queryTemplate id (BBDATA-014)', async () => {
    vi.mocked(runQuery).mockImplementation(async (opts: { template: string }) => ({
      data: [{ marker: opts.template }],
      formatted: '{}',
      meta: { template: opts.template, source: 'savant', cached: false, sampleSize: 1, season: 2025, queryTimeMs: 0 },
    }));

    const result = await report({
      template: 'pro-pitcher-eval',
      player: 'Corbin Burnes',
      season: 2025,
      audience: 'scout',
      format: 'json',
    });

    const parsed = JSON.parse(result.formatted);
    expect(parsed).toHaveProperty('sections');
    // pro-pitcher-eval has 4 data requirements after BBDATA-003;
    // sections should hold one entry per id.
    const sectionKeys = Object.keys(parsed.sections);
    expect(sectionKeys.length).toBe(4);
    // Each section's value should be the raw query data, not a markdown string.
    for (const key of sectionKeys) {
      expect(Array.isArray(parsed.sections[key])).toBe(true);
      expect(parsed.sections[key][0]).toEqual({ marker: key });
    }
    // The markdown `content` field is preserved for back-compat.
    expect(typeof parsed.content).toBe('string');
    expect(parsed.content.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 0.12 "say what you do" release — P5.2 scaffold marking, P5.3 audience content
// ---------------------------------------------------------------------------

const DATA_DRIVEN = [
  'pro-pitcher-eval',
  'pro-hitter-eval',
  'relief-pitcher-quick',
  'advance-sp',
  'trade-target-onepager',
] as const;

const SCAFFOLDS = [
  'college-pitcher-draft',
  'college-hitter-draft',
  'hs-prospect',
  'advance-lineup',
  'dev-progress',
  'post-promotion',
  'draft-board-card',
  'draft-board-card-pitcher',
] as const;

describe('P5.2 — scaffold templates say so', () => {
  it('classifies exactly the no-fetch templates as scaffolds', () => {
    const listed = listReportTemplates();
    const flagged = listed.filter((t) => t.scaffold).map((t) => t.id).sort();
    expect(flagged).toEqual([...SCAFFOLDS].sort());
  });

  it('never flags a template that fetches data', () => {
    for (const id of DATA_DRIVEN) {
      const template = getReportTemplate(id)!;
      expect(isScaffoldTemplate(template)).toBe(false);
    }
  });

  it('--validate warns that a scaffold fetched nothing', async () => {
    const result = await report({
      template: 'hs-prospect',
      player: 'Some Prospect',
      season: 2025,
      validate: true,
    });

    expect(result.validation?.checks).toContain('scaffold-template');
    const scaffoldIssue = result.validation?.issues.find((i) =>
      i.message.includes('Scaffold template'),
    );
    expect(scaffoldIssue).toBeDefined();
    // A warning, not an error — running a scaffold is legitimate.
    expect(scaffoldIssue?.severity).toBe('warning');
  });

  it('does not warn about scaffolding on a data-driven template', async () => {
    const result = await report({
      template: 'pro-pitcher-eval',
      player: 'Corbin Burnes',
      season: 2025,
      validate: true,
    });

    expect(
      result.validation?.issues.some((i) => i.message.includes('Scaffold template')),
    ).toBe(false);
  });
});

describe('P5.3 — --audience changes the body, not just the header', () => {
  it.each(DATA_DRIVEN)('%s renders differently for coach and gm', async (template) => {
    const coach = await report({ template, player: 'Corbin Burnes', season: 2025, audience: 'coach' });
    const gm = await report({ template, player: 'Corbin Burnes', season: 2025, audience: 'gm' });

    // Strip the header line, which already differed before this release —
    // the claim under test is that the BODY changes.
    const body = (s: string) => s.split('\n').filter((l) => !l.startsWith('**Season:')).join('\n');
    expect(body(coach.content)).not.toBe(body(gm.content));
  });

  it.each(DATA_DRIVEN)('%s keeps every required section at every audience', async (template) => {
    const required = getReportTemplate(template)!.requiredSections;
    for (const audience of ['coach', 'gm', 'scout', 'analyst'] as const) {
      const result = await report({ template, player: 'Corbin Burnes', season: 2025, audience });
      for (const section of required) {
        expect(result.content, `${template} @ ${audience} lost "${section}"`).toContain(section);
      }
    }
  });

  it('falls back to the analyst lens for an audience a template does not list', async () => {
    // The `audiences` array on ReportTemplate is declared but not enforced, so
    // any audience can reach any template. The {{else}} branch is what keeps
    // that from rendering an empty block.
    const result = await report({
      template: 'relief-pitcher-quick',
      player: 'Emmanuel Clase',
      season: 2025,
      audience: 'analyst',
    });
    expect(result.content).toContain('How to Read This');
    expect(result.content).toContain('analyst');
  });

  it('validates green at every audience on a data-driven template', async () => {
    for (const audience of ['coach', 'gm', 'scout', 'analyst'] as const) {
      const result = await report({
        template: 'pro-pitcher-eval',
        player: 'Corbin Burnes',
        season: 2025,
        audience,
        validate: true,
      });
      expect(result.validation?.passed, `failed at ${audience}`).toBe(true);
    }
  });
});

// Regression guard for a defect the P5.3 audience tests exposed: twelve of the
// thirteen templates declared a "Header" section no .hbs renders, and advance-sp
// declared "Times Through Order" against a heading reading "Times Through the
// Order". `section-present` is warning-only, so both had been failing silently.
// A declared required section that no template can emit is drift in the same
// family as P5.2 — the registry claiming something the output does not do.
describe('requiredSections agree with what the templates render', () => {
  it.each(listReportTemplates().map((t) => t.id))(
    '%s renders every section it declares',
    async (id) => {
      const template = getReportTemplate(id)!;
      const result = await report({ template: id, player: 'Corbin Burnes', season: 2025 });
      for (const section of template.requiredSections) {
        expect(result.content, `${id} declares "${section}" but never renders it`).toContain(section);
      }
    },
  );
});
