import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'server',
          root: './server',
          environment: 'node',
          include: ['test/**/*.test.ts'],
          fileParallelism: false,
          testTimeout: 30000,
          hookTimeout: 30000,
          alias: {
            'node:test': 'vitest',
          },
        },
      },
      {
        test: {
          name: 'client',
          root: './client',
          environment: 'jsdom',
          setupFiles: ['./test/setup.ts'],
          include: ['test/**/*.test.{ts,tsx}'],
        },
      },
    ],
  },
});
