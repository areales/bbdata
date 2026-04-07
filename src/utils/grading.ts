import chalk from 'chalk';

/**
 * The 20-80 scouting scale used throughout baseball.
 *
 * 80 = elite (top ~2%)
 * 70 = plus-plus (top ~5%)
 * 60 = plus (above average)
 * 55 = above average
 * 50 = average
 * 45 = below average
 * 40 = fringe
 * 30 = poor
 * 20 = non-existent
 */

export type ScoutGrade = 20 | 25 | 30 | 35 | 40 | 45 | 50 | 55 | 60 | 65 | 70 | 75 | 80;

export function gradeLabel(grade: number): string {
  if (grade >= 70) return 'Plus-Plus';
  if (grade >= 60) return 'Plus';
  if (grade >= 55) return 'Above Average';
  if (grade >= 50) return 'Average';
  if (grade >= 45) return 'Below Average';
  if (grade >= 40) return 'Fringe';
  if (grade >= 30) return 'Poor';
  return 'Non-existent';
}

export function gradeColor(grade: number): string {
  if (grade >= 70) return chalk.green.bold(String(grade));
  if (grade >= 60) return chalk.green(String(grade));
  if (grade >= 55) return chalk.cyan(String(grade));
  if (grade >= 50) return chalk.white(String(grade));
  if (grade >= 45) return chalk.yellow(String(grade));
  if (grade >= 40) return chalk.red(String(grade));
  return chalk.red.dim(String(grade));
}

export function formatGrade(grade: number): string {
  return `${gradeColor(grade)} (${gradeLabel(grade)})`;
}

/**
 * Convert a percentile rank to a 20-80 grade.
 * Percentile 50 = grade 50, percentile 90 = ~grade 65, percentile 99 = ~grade 80.
 */
export function percentileToGrade(percentile: number): ScoutGrade {
  if (percentile >= 99) return 80;
  if (percentile >= 95) return 70;
  if (percentile >= 85) return 60;
  if (percentile >= 70) return 55;
  if (percentile >= 50) return 50;
  if (percentile >= 30) return 45;
  if (percentile >= 15) return 40;
  if (percentile >= 5) return 30;
  return 20;
}
