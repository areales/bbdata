import { describe, it, expect } from 'vitest';
import { gradeLabel, percentileToGrade } from '../../src/utils/grading.js';

describe('gradeLabel', () => {
  it('returns correct labels at each grade tier', () => {
    expect(gradeLabel(80)).toBe('Plus-Plus');
    expect(gradeLabel(70)).toBe('Plus-Plus');
    expect(gradeLabel(60)).toBe('Plus');
    expect(gradeLabel(55)).toBe('Above Average');
    expect(gradeLabel(50)).toBe('Average');
    expect(gradeLabel(45)).toBe('Below Average');
    expect(gradeLabel(40)).toBe('Fringe');
    expect(gradeLabel(30)).toBe('Poor');
    expect(gradeLabel(20)).toBe('Non-existent');
  });

  it('handles boundary values correctly', () => {
    expect(gradeLabel(69)).toBe('Plus');
    expect(gradeLabel(59)).toBe('Above Average');
    expect(gradeLabel(29)).toBe('Non-existent');
  });
});

describe('percentileToGrade', () => {
  it('maps percentiles to correct scouting grades', () => {
    expect(percentileToGrade(99)).toBe(80);
    expect(percentileToGrade(95)).toBe(70);
    expect(percentileToGrade(85)).toBe(60);
    expect(percentileToGrade(70)).toBe(55);
    expect(percentileToGrade(50)).toBe(50);
    expect(percentileToGrade(30)).toBe(45);
    expect(percentileToGrade(15)).toBe(40);
    expect(percentileToGrade(5)).toBe(30);
    expect(percentileToGrade(2)).toBe(20);
  });

  it('returns grade 50 for exactly 50th percentile', () => {
    expect(percentileToGrade(50)).toBe(50);
  });
});
