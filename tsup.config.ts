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
    // Add shebang only to the bin entry
    js: (ctx) => ctx.options.entry?.toString().includes('bbdata')
      ? '#!/usr/bin/env node'
      : '',
  },
});
