import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import path from 'node:path';

export default defineConfig({
  define: {
    'process.env': {
      NODE_ENV: 'test',
      NEXT_PUBLIC_API_URL: 'http://localhost:3001',
      NEXT_PUBLIC_WS_URL: 'ws://localhost:3001',
      NEXT_PUBLIC_SOCIAL_WHATSAPP_CHANNEL: 'https://whatsapp.com/channel/0029VbDEVo70G0XbUx6MK90w',
      NEXT_PUBLIC_SOCIAL_INSTAGRAM: 'https://www.instagram.com/smex_official_store?srtk=MTB0aXRheHBvOGk5YQ==',
    },
  },
  test: {
    projects: [
      {
        test: {
          name: 'server',
          root: './server',
          environment: 'node',
          setupFiles: ['./test/setup.ts'],
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
          browser: {
            enabled: true,
            provider: playwright(),
            instances: [
              { browser: 'chromium' },
              { browser: 'firefox' },
              { browser: 'webkit' },
            ],
            headless: true,
          },
          setupFiles: ['./test/setup.ts'],
          include: ['test/**/*.test.{ts,tsx}'],
          alias: {
            'next/navigation': path.resolve(__dirname, './client/test/mocks/navigation.ts'),
          },
        },
      },
    ],
  },
});
