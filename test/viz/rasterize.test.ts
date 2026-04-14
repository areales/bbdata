import { describe, it, expect } from 'vitest';
import { rasterizeSvg } from '../../src/viz/rasterize.js';

// The first resvg call in a process loads system fonts, which can take
// 5–10s on Windows. Bump the suite-level timeout so the cold-start test
// doesn't trip vitest's 5s default.
describe('rasterizeSvg', { timeout: 30_000 }, () => {
  it('produces a PNG buffer from a minimal SVG', () => {
    const svg = `<?xml version="1.0"?>
      <svg xmlns="http://www.w3.org/2000/svg" width="100" height="50" viewBox="0 0 100 50">
        <rect x="0" y="0" width="100" height="50" fill="red"/>
      </svg>`;
    const png = rasterizeSvg(svg, { width: 200 });
    expect(Buffer.isBuffer(png)).toBe(true);
    expect(png.byteLength).toBeGreaterThan(0);
    // PNG file signature: 89 50 4E 47 0D 0A 1A 0A
    expect(png[0]).toBe(0x89);
    expect(png[1]).toBe(0x50);
    expect(png[2]).toBe(0x4e);
    expect(png[3]).toBe(0x47);
  });

  it('honors the requested width', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50" viewBox="0 0 100 50">
      <rect width="100" height="50" fill="blue"/>
    </svg>`;
    const small = rasterizeSvg(svg, { width: 100 });
    const big = rasterizeSvg(svg, { width: 400 });
    expect(big.byteLength).toBeGreaterThan(small.byteLength);
  });
});
