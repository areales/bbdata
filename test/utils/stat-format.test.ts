import { describe, it, expect } from 'vitest';
import { fmtPercent } from '../../src/utils/stat-format.js';

describe('fmtPercent', () => {
  it('scales FanGraphs-style ratios by 100 (P1.4/P1.5 regression)', () => {
    expect(fmtPercent(0.186)).toBe('18.6%');
    expect(fmtPercent(0.185)).toBe('18.5%');
    expect(fmtPercent(0.28)).toBe('28.0%');
  });

  it('passes already-scaled values through unscaled', () => {
    expect(fmtPercent(18.6)).toBe('18.6%');
    expect(fmtPercent(25.4)).toBe('25.4%');
  });

  it('treats negative ratios as ratios (K-BB% can be negative)', () => {
    expect(fmtPercent(-0.02)).toBe('-2.0%');
    expect(fmtPercent(-5.3)).toBe('-5.3%');
  });

  it('accepts numeric strings', () => {
    expect(fmtPercent('0.186')).toBe('18.6%');
    expect(fmtPercent('18.6')).toBe('18.6%');
  });

  it('renders em-dash for null, empty, and non-numeric input', () => {
    expect(fmtPercent(null)).toBe('—');
    expect(fmtPercent('')).toBe('—');
    expect(fmtPercent('N/A')).toBe('—');
  });

  it('renders zero as 0.0%', () => {
    expect(fmtPercent(0)).toBe('0.0%');
  });
});
