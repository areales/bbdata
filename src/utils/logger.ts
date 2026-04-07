import chalk from 'chalk';

// Silent when stdout is piped (agent-friendly)
const isTTY = process.stdout.isTTY ?? false;

export const log = {
  info(message: string): void {
    if (isTTY) {
      process.stderr.write(chalk.blue('ℹ ') + message + '\n');
    }
  },

  success(message: string): void {
    if (isTTY) {
      process.stderr.write(chalk.green('✓ ') + message + '\n');
    }
  },

  warn(message: string): void {
    // Warnings always show (stderr doesn't interfere with piped stdout)
    process.stderr.write(chalk.yellow('⚠ ') + message + '\n');
  },

  error(message: string): void {
    process.stderr.write(chalk.red('✗ ') + message + '\n');
  },

  debug(message: string): void {
    if (process.env.BBDATA_DEBUG) {
      process.stderr.write(chalk.gray('⋯ ') + message + '\n');
    }
  },

  /** Print data to stdout — this is what agents/pipes consume */
  data(content: string): void {
    process.stdout.write(content);
  },
};
