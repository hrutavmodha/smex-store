import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    server: 'src/server.ts',
    app: 'src/app.ts',
    migrate: 'src/db/migrate.ts',
  },
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
