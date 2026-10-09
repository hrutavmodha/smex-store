import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/app.ts'],
  format: ['esm'],
  clean: true,
  minify: true,
  sourcemap: true,
  outExtension: () => ({ js: '.js' }),
  platform: 'node',
})
