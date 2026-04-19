export type ReportCategory = 'pro-scouting' | 'amateur-scouting' | 'advance' | 'player-dev' | 'executive';
export type Audience = 'coach' | 'gm' | 'scout' | 'analyst';

export interface ReportTemplate {
  id: string;
  name: string;
  category: ReportCategory;
  description: string;
  audiences: Audience[];
  templateFile: string;

  /** What data queries this report needs */
  dataRequirements: {
    queryTemplate: string;
    paramMapping: Record<string, string>;
    required: boolean;
  }[];

  /** Sections that must be present in the output */
  requiredSections: string[];

  examples: string[];
}

// Template registry
const templates = new Map<string, ReportTemplate>();

export function registerReportTemplate(template: ReportTemplate): void {
  templates.set(template.id, template);
}

export function getReportTemplate(id: string): ReportTemplate | undefined {
  return templates.get(id);
}

export function getAllReportTemplates(): ReportTemplate[] {
  return Array.from(templates.values());
}

export function getReportTemplatesByCategory(category: ReportCategory): ReportTemplate[] {
  return getAllReportTemplates().filter((t) => t.category === category);
}

export function listReportTemplates(): { id: string; name: string; category: string; description: string }[] {
  return getAllReportTemplates().map((t) => ({
    id: t.id,
    name: t.name,
    category: t.category,
    description: t.description,
  }));
}

// --- Register all 12 report templates ---

registerReportTemplate({
  id: 'pro-pitcher-eval',
  name: 'Pro Pitcher Evaluation',
  category: 'pro-scouting',
  description: 'Full MLB/MiLB pitcher assessment for trade/free agency decisions',
  audiences: ['gm', 'scout', 'analyst'],
  templateFile: 'pro-pitcher-eval.hbs',
  dataRequirements: [
    { queryTemplate: 'pitcher-arsenal', paramMapping: { player: 'player' }, required: true },
    { queryTemplate: 'pitcher-velocity-trend', paramMapping: { player: 'player' }, required: false },
    { queryTemplate: 'pitcher-handedness-splits', paramMapping: { player: 'player' }, required: true },
    // BBDATA-003: FanGraphs season stats for the Performance Profile section.
    // required:false because FanGraphs occasionally 500s — we don't want a
    // flaky FG day to break the entire pro eval; the Performance Profile
    // section will fall back to placeholder text instead.
    { queryTemplate: 'pitcher-season-profile', paramMapping: { player: 'player' }, required: false },
  ],
  requiredSections: ['Header', 'Pitch Arsenal', 'Performance Profile', 'Splits Analysis', 'Trend Analysis', 'Risk Assessment', 'Comparable Player', 'Role Projection'],
  examples: ['bbdata report pro-pitcher-eval --player "Corbin Burnes"'],
});

registerReportTemplate({
  id: 'pro-hitter-eval',
  name: 'Pro Hitter Evaluation',
  category: 'pro-scouting',
  description: 'Full MLB/MiLB hitter assessment for acquisition decisions',
  audiences: ['gm', 'scout', 'analyst'],
  templateFile: 'pro-hitter-eval.hbs',
  dataRequirements: [
    { queryTemplate: 'hitter-batted-ball', paramMapping: { player: 'player' }, required: true },
    { queryTemplate: 'hitter-vs-pitch-type', paramMapping: { player: 'player' }, required: true },
    { queryTemplate: 'hitter-hot-cold-zones', paramMapping: { player: 'player' }, required: false },
    { queryTemplate: 'hitter-handedness-splits', paramMapping: { player: 'player' }, required: false },
    { queryTemplate: 'trend-rolling-average', paramMapping: { player: 'player' }, required: false },
    // BBDATA-004: FanGraphs season stats for the Performance Profile section.
    // Same required:false rationale as pro-pitcher-eval — the report should
    // degrade gracefully if FanGraphs is unreachable.
    { queryTemplate: 'hitter-season-profile', paramMapping: { player: 'player' }, required: false },
  ],
  requiredSections: ['Header', 'Batted Ball Profile', 'Performance Profile', 'Approach & Discipline', 'Splits Analysis', 'Trend Analysis', 'Risk Assessment', 'Comparable Player', 'Role Projection'],
  examples: ['bbdata report pro-hitter-eval --player "Juan Soto"'],
});

registerReportTemplate({
  id: 'relief-pitcher-quick',
  name: 'Relief Pitcher Quick Eval',
  category: 'pro-scouting',
  description: 'Fast 1-page evaluation for bullpen additions',
  audiences: ['gm', 'scout'],
  templateFile: 'relief-pitcher-quick.hbs',
  dataRequirements: [
    { queryTemplate: 'pitcher-arsenal', paramMapping: { player: 'player' }, required: true },
  ],
  requiredSections: ['Header', 'Arsenal', 'Key Metrics', 'Recommendation'],
  examples: ['bbdata report relief-pitcher-quick --player "Edwin Diaz"'],
});

registerReportTemplate({
  id: 'college-pitcher-draft',
  name: 'College Pitcher Draft Report',
  category: 'amateur-scouting',
  description: 'Draft evaluation with tools and projection focus',
  audiences: ['gm', 'scout'],
  templateFile: 'college-pitcher-draft.hbs',
  dataRequirements: [],
  requiredSections: ['Header', 'Physical', 'Arsenal Grades', 'Performance', 'Projection', 'Risk', 'Recommendation'],
  examples: ['bbdata report college-pitcher-draft --player "Chase Burns"'],
});

registerReportTemplate({
  id: 'college-hitter-draft',
  name: 'College Hitter Draft Report',
  category: 'amateur-scouting',
  description: 'Draft evaluation with tools and projection focus',
  audiences: ['gm', 'scout'],
  templateFile: 'college-hitter-draft.hbs',
  dataRequirements: [],
  requiredSections: ['Header', 'Physical', 'Tool Grades', 'Performance', 'Projection', 'Risk', 'Recommendation'],
  examples: ['bbdata report college-hitter-draft --player "Charlie Condon"'],
});

registerReportTemplate({
  id: 'hs-prospect',
  name: 'High School Prospect Report',
  category: 'amateur-scouting',
  description: 'Tools-and-projection focused (stats unreliable at HS level)',
  audiences: ['gm', 'scout'],
  templateFile: 'hs-prospect.hbs',
  dataRequirements: [],
  requiredSections: ['Header', 'Physical', 'Tool Grades', 'Makeup', 'Projection', 'Signability', 'Recommendation'],
  examples: ['bbdata report hs-prospect --player "Prospect Name"'],
});

registerReportTemplate({
  id: 'advance-sp',
  name: 'Advance Report: Starting Pitcher',
  category: 'advance',
  description: 'Game prep for opposing starter — actionable, 1-page, bullet-point format',
  audiences: ['coach', 'analyst'],
  templateFile: 'advance-sp.hbs',
  dataRequirements: [
    { queryTemplate: 'pitcher-arsenal', paramMapping: { player: 'player' }, required: true },
    { queryTemplate: 'pitcher-handedness-splits', paramMapping: { player: 'player' }, required: true },
    // BBDATA-011: tactical pitch-level queries that populate the 4 sections
    // (Recent Form, By Count, TTO, Late-in-Game) that previously rendered
    // as hardcoded placeholders. All required:false so a Savant flake or
    // a pitcher with no recent starts degrades gracefully to "data not
    // available" rather than aborting the report.
    { queryTemplate: 'pitcher-recent-form', paramMapping: { player: 'player' }, required: false },
    { queryTemplate: 'pitcher-by-count', paramMapping: { player: 'player' }, required: false },
    { queryTemplate: 'pitcher-tto', paramMapping: { player: 'player' }, required: false },
  ],
  requiredSections: ['Header', 'Recent Form', 'Pitch Mix & Sequencing', 'Times Through Order', 'Platoon Vulnerabilities', 'How to Attack'],
  examples: ['bbdata report advance-sp --player "Gerrit Cole" --audience coach'],
});

registerReportTemplate({
  id: 'advance-lineup',
  name: 'Advance Report: Opposing Lineup',
  category: 'advance',
  description: 'Hitter-by-hitter breakdown for pitchers and catchers',
  audiences: ['coach', 'analyst'],
  templateFile: 'advance-lineup.hbs',
  dataRequirements: [],
  requiredSections: ['Header', 'Lineup Overview', 'Hitter Breakdowns', 'Key Matchups'],
  examples: ['bbdata report advance-lineup --team NYY'],
});

registerReportTemplate({
  id: 'dev-progress',
  name: 'Development Progress Report',
  category: 'player-dev',
  description: 'Track minor league player growth over time (monthly/quarterly)',
  audiences: ['scout', 'analyst'],
  templateFile: 'dev-progress.hbs',
  dataRequirements: [],
  requiredSections: ['Header', 'Current Stats', 'Trend Analysis', 'Mechanical Notes', 'Development Goals', 'Next Steps'],
  examples: ['bbdata report dev-progress --player "Jackson Holliday"'],
});

registerReportTemplate({
  id: 'post-promotion',
  name: 'Post-Promotion Evaluation',
  category: 'player-dev',
  description: 'Assess player adjustment after level change',
  audiences: ['scout', 'analyst'],
  templateFile: 'post-promotion.hbs',
  dataRequirements: [],
  requiredSections: ['Header', 'Pre-Promotion Stats', 'Post-Promotion Stats', 'Adjustment Analysis', 'Recommendation'],
  examples: ['bbdata report post-promotion --player "Jackson Holliday"'],
});

registerReportTemplate({
  id: 'trade-target-onepager',
  name: 'Trade Target One-Pager',
  category: 'executive',
  description: 'Condensed 2-minute evaluation for GM-level trade decisions',
  audiences: ['gm'],
  templateFile: 'trade-target-onepager.hbs',
  dataRequirements: [
    { queryTemplate: 'hitter-batted-ball', paramMapping: { player: 'player' }, required: false },
    { queryTemplate: 'pitcher-arsenal', paramMapping: { player: 'player' }, required: false },
  ],
  requiredSections: ['Header', 'Key Stats', 'Strengths', 'Concerns', 'Fit Assessment', 'Recommendation'],
  examples: ['bbdata report trade-target-onepager --player "Vladimir Guerrero Jr." --audience gm'],
});

registerReportTemplate({
  id: 'draft-board-card',
  name: 'Draft Board Summary Card',
  category: 'executive',
  description: 'Glanceable index card for draft room use (hitter tool grades)',
  audiences: ['gm', 'scout'],
  templateFile: 'draft-board-card.hbs',
  dataRequirements: [],
  requiredSections: ['Name', 'Position', 'School', 'Tool Grades', 'Projection', 'Comp', 'Round Range'],
  examples: ['bbdata report draft-board-card --player "Prospect Name"'],
});

// BBDATA-013: pitcher variant uses Fastball/Breaking/Changeup/Command tool
// grades instead of hitter's Hit/Power/Speed/Field/Arm. Separate template so
// the hitter card (`draft-board-card`) stays stable for existing scripts.
registerReportTemplate({
  id: 'draft-board-card-pitcher',
  name: 'Draft Board Summary Card (Pitcher)',
  category: 'executive',
  description: 'Glanceable index card for draft room use — pitcher variant (Fastball/Breaking/Changeup/Command tool grades)',
  audiences: ['gm', 'scout'],
  templateFile: 'draft-board-card-pitcher.hbs',
  dataRequirements: [],
  requiredSections: ['Name', 'Position', 'School', 'Tool Grades', 'Projection', 'Comp', 'Round Range'],
  examples: ['bbdata report draft-board-card-pitcher --player "Seth Hernandez"'],
});
