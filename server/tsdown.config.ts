import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/server.ts', 'src/app.ts'],
  format: ['esm'],
  clean: true,
  minify: true,
  sourcemap: true,
  outExtension: () => ({ js: '.mjs' }),
  platform: 'node',
  deps: {
    alwaysBundle: ['@smex/shared'],
  },
})
