import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'bin/bbdata.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'node18',
  splitting: false,
  shims: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
});
