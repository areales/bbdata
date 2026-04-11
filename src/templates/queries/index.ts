// Import all templates to trigger registration
import './pitcher-arsenal.js';
import './pitcher-velocity-trend.js';
import './pitcher-handedness-splits.js';
import './hitter-batted-ball.js';
import './hitter-vs-pitch-type.js';
import './hitter-hot-cold-zones.js';
import './hitter-handedness-splits.js';
import './matchup-pitcher-vs-hitter.js';
import './matchup-situational.js';
import './leaderboard-custom.js';
import './leaderboard-comparison.js';
import './trend-rolling-average.js';
import './trend-year-over-year.js';
import './pitcher-raw-pitches.js';
import './hitter-raw-bip.js';
import './hitter-zone-grid.js';

export {
  getTemplate,
  getAllTemplates,
  getTemplatesByCategory,
  listTemplates,
  type QueryTemplate,
  type QueryTemplateParams,
  type QueryResult,
  type QueryCategory,
} from './registry.js';
