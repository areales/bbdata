// Pin test worker to UTC so Vega time-scale axis labels are stable across
// developer machines. The rolling chart's fixtures use ISO date strings
// parsed as UTC midnight; rendering in a negative-offset zone (e.g. PDT)
// shifts every label back a day and breaks SVG snapshots. Applied at
// worker boot via vitest's `setupFiles` so it takes effect before any
// test module (and therefore Vega) is imported.
process.env.TZ = 'UTC';
