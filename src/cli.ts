import { Command } from 'commander';
import { registerQueryCommand } from './commands/query.js';
import { registerReportCommand } from './commands/report.js';
import { registerVizCommand } from './commands/viz.js';

export const program = new Command();

program
  .name('bbdata')
  .description('Baseball data CLI — query stats, generate scouting reports, and build analytics pipelines')
  .version('0.1.0');

registerQueryCommand(program);
registerReportCommand(program);
registerVizCommand(program);
