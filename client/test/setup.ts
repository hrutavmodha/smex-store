import { vi } from 'vitest';

// Provide browser-compatible process.env and global shim in real browsers
if (typeof globalThis.global === 'undefined') {
  (globalThis as any).global = globalThis;
}

if (typeof globalThis.process === 'undefined' || !globalThis.process?.env) {
  (globalThis as any).process = {
    env: {
      NODE_ENV: 'test',
      NEXT_PUBLIC_API_URL: 'http://localhost:3001',
      NEXT_PUBLIC_WS_URL: 'ws://localhost:3001',
      NEXT_PUBLIC_SOCIAL_WHATSAPP_CHANNEL: 'https://whatsapp.com/channel/0029VbDEVo70G0XbUx6MK90w',
      NEXT_PUBLIC_SOCIAL_INSTAGRAM: 'https://www.instagram.com/smex_official_store?srtk=MTB0aXRheHBvOGk5YQ==',
    },
  };
}

// Setup mock localStorage if not present
if (typeof window !== 'undefined' && !window.localStorage) {
  const mockStorage: Record<string, string> = {};
  const localStorageMock = {
    getItem: (k: string) => mockStorage[k] || null,
    setItem: (k: string, v: string) => {
      mockStorage[k] = v;
    },
    removeItem: (k: string) => {
      delete mockStorage[k];
    },
    clear: () => {
      for (const key of Object.keys(mockStorage)) delete mockStorage[key];
    },
  };

  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    configurable: true,
    writable: true,
  });
  (globalThis as any).localStorage = localStorageMock;
}

// Clean up fallback QueryClient between tests
import { afterEach } from 'vitest';
import { notifyManager } from '@tanstack/react-query';
import { getFallbackQueryClient } from '../providers/QueryProvider';

notifyManager.setScheduler((cb) => queueMicrotask(cb));

afterEach(() => {
  getFallbackQueryClient().clear();
});

// End of setup.ts

