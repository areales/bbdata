import { describe, it, expect } from 'vitest';
import { fmtPercent } from '../../src/utils/format.js';

describe('fmtPercent', () => {
  it('scales ratio-form rates by 100 (P1.4 / P1.5 regression)', () => {
    // FanGraphs returns rate stats as ratios: 0.186 means 18.6%.
    expect(fmtPercent(0.186)).toBe('18.6%');
    expect(fmtPercent(0.02)).toBe('2.0%');
  });

  it('passes already-scaled values through unchanged', () => {
    expect(fmtPercent(18.6)).toBe('18.6%');
    expect(fmtPercent(104.2)).toBe('104.2%');
  });

  it('handles negative rates in both representations', () => {
    // K-BB% can go negative for wild low-strikeout pitchers.
    expect(fmtPercent(-0.031)).toBe('-3.1%');
    expect(fmtPercent(-3.1)).toBe('-3.1%');
  });

  it('renders em-dash for missing values', () => {
    expect(fmtPercent(null)).toBe('—');
    expect(fmtPercent('')).toBe('—');
  });

  it('accepts numeric strings', () => {
    expect(fmtPercent('0.186')).toBe('18.6%');
    expect(fmtPercent('18.6')).toBe('18.6%');
  });
});
