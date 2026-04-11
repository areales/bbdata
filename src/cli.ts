import { Command } from 'commander';
import { registerQueryCommand } from './commands/query.js';
import { registerReportCommand } from './commands/report.js';
import { registerVizCommand } from './commands/viz.js';
import { CLI_VERSION } from './utils/version.js';

export const program = new Command();

program
  .name('bbdata')
  .description('Baseball data CLI — query stats, generate scouting reports, and build analytics pipelines')
  .version(CLI_VERSION);

registerQueryCommand(program);
registerReportCommand(program);
registerVizCommand(program);
