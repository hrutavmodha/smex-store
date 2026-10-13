/**
 * Mock implementation of next/navigation for browser-based component test harnesses.
 */
import { vi } from 'vitest';

export const mockRouter = {
  push: vi.fn((url: string) => {}),
  replace: vi.fn((url: string) => {}),
  prefetch: vi.fn((url: string) => {}),
  back: vi.fn(() => {}),
  forward: vi.fn(() => {}),
  refresh: vi.fn(() => {}),
};

export function useRouter() {
  return mockRouter;
}

export function useSearchParams() {
  if (typeof window !== 'undefined' && window.location.search) {
    return new URLSearchParams(window.location.search);
  }
  return new URLSearchParams();
}

export function usePathname() {
  if (typeof window !== 'undefined' && window.location.pathname) {
    return window.location.pathname;
  }
  return '/';
}

export function useParams() {
  return {};
}
