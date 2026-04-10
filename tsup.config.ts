import { defineConfig } from 'tsup';
import { cpSync } from 'node:fs';

export default defineConfig({
  entry: ['src/index.ts', 'bin/bbdata.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'node18',
  splitting: false,
  shims: true,
  external: ['vega', 'vega-lite'],
  banner: {
    js: '#!/usr/bin/env node',
  },
  async onSuccess() {
    cpSync('src/templates', 'dist/templates', { recursive: true });
  },
});
