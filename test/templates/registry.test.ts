import { describe, it, expect } from 'vitest';

// Import all templates to trigger registration
import '../../src/templates/queries/index.js';
import {
  getTemplate,
  getAllTemplates,
  getTemplatesByCategory,
  listTemplates,
} from '../../src/templates/queries/registry.js';

describe('query template registry', () => {
  it('has all 22 templates registered', () => {
    const all = getAllTemplates();
    // 12 original + 3 viz-raw (pitcher-raw-pitches, hitter-raw-bip, hitter-zone-grid)
    // + 1 hitter-handedness-splits
    // + 3 BBDATA-011 advance-sp tactical (pitcher-recent-form, pitcher-by-count, pitcher-tto)
    // + 2 BBDATA-003/004 FanGraphs season profiles (pitcher-season-profile, hitter-season-profile)
    // + 1 F1.1 pro-pitcher-eval rolling chart (pitcher-rolling-trend)
    expect(all.length).toBe(22);
  });

  it('listTemplates returns id, name, category, description for each', () => {
    const list = listTemplates();
    expect(list.length).toBe(22);

    for (const t of list) {
      expect(t).toHaveProperty('id');
      expect(t).toHaveProperty('name');
      expect(t).toHaveProperty('category');
      expect(t).toHaveProperty('description');
    }
  });

  it('getTemplate returns a specific template', () => {
    const t = getTemplate('pitcher-arsenal');
    expect(t).toBeDefined();
    expect(t!.id).toBe('pitcher-arsenal');
  });

  it('getTemplate returns undefined for unknown ID', () => {
    expect(getTemplate('nonexistent')).toBeUndefined();
  });

  it('getTemplatesByCategory returns pitcher templates', () => {
    const pitcher = getTemplatesByCategory('pitcher');
    expect(pitcher.length).toBeGreaterThanOrEqual(3);
    expect(pitcher.every((t) => t.category === 'pitcher')).toBe(true);
  });

  it('getTemplatesByCategory returns hitter templates', () => {
    const hitter = getTemplatesByCategory('hitter');
    expect(hitter.length).toBeGreaterThanOrEqual(3);
    expect(hitter.every((t) => t.category === 'hitter')).toBe(true);
  });

  it('all template IDs are unique', () => {
    const all = getAllTemplates();
    const ids = all.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every template has required fields', () => {
    for (const t of getAllTemplates()) {
      expect(t.id).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(t.category).toBeTruthy();
      expect(t.preferredSources.length).toBeGreaterThan(0);
      expect(typeof t.buildQuery).toBe('function');
      expect(typeof t.transform).toBe('function');
      expect(typeof t.columns).toBe('function');
    }
  });
});
