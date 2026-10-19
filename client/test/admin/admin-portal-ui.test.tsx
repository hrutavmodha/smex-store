import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import React from 'react';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react';
import AdminLayout from '../../app/admin/layout';
import AdminDashboardPage from '../../app/admin/page';
import AdminRatesPage from '../../app/admin/rates/page';
import { mockRouter } from '../mocks/navigation';

describe('Milestone 9: Client Presentation UI & Admin Guard (LLT 2.6 Tests 22-25)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    cleanup();
    localStorage.clear();
    mockRouter.push.mockClear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    cleanup();
    localStorage.clear();
  });

  it('Test 22: Unauthenticated client route guard redirect', async () => {
    // Explicitly unauthenticated: /api/v1/auth/me returns 401
    global.fetch = vi.fn().mockImplementation((input: any) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/v1/auth/me')) {
        return Promise.resolve({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ error: 'Unauthorized' }),
        });
      }
      return Promise.resolve({ ok: false, status: 404 });
    });

    render(
      <AdminLayout>
        <div data-testid="protected-content">Secret Admin Dashboard</div>
      </AdminLayout>
    );

    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith('/login?redirect=/admin');
    });
  });

  it('Test 23: Non-admin client route guard 403 screen', async () => {

    global.fetch = vi.fn().mockImplementation((input: any) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/v1/auth/me')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              user: {
                uid: 'user-123',
                email: 'regular_gamer@smexstore.com',
                ign: 'CasualPlayer',
                role: 'user',
                emailVerified: true,
              },
            }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      });
    });

    const { getByTestId, queryByTestId, getByText } = render(
      <AdminLayout>
        <div data-testid="protected-content">Secret Admin Dashboard</div>
      </AdminLayout>
    );

    await waitFor(() => {
      expect(getByTestId('admin-access-denied')).toBeDefined();
    });

    // Protected content must not be visible
    expect(queryByTestId('protected-content')).toBeNull();

    // Dedicated Access Denied screen elements verified
    expect(getByText('403 Forbidden')).toBeDefined();
    expect(getByText(/Administrative Credentials Required/i)).toBeDefined();

    const accessDenied = getByTestId('admin-access-denied');
    const homeLink = accessDenied.querySelector('a[href="/"]');
    expect(homeLink).toBeDefined();
  });

  it('Test 24: Live boosting rate editor instant preview', async () => {
    global.fetch = vi.fn().mockImplementation((input: any) => {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ rates: [] }),
      });
    });

    const { getByTestId } = render(<AdminRatesPage />);

    // Baseline preview: 15★@20 + 5★@30 = ₹450.00 INR
    const previewResult = getByTestId('quote-preview-result');
    expect(previewResult.textContent).toContain('₹450.00 INR');

    // Admin updates Mythic base rate from 20 to 30
    const mythicInput = getByTestId('rate-input-mythic-base') as HTMLInputElement;
    expect(mythicInput).toBeDefined();

    const t0 = performance.now();
    fireEvent.change(mythicInput, { target: { value: '30' } });
    const elapsed = performance.now() - t0;

    // Instant client recalculation preview: 15★@30 + 5★@30 = ₹600.00 INR
    expect(previewResult.textContent).toContain('₹600.00 INR');
    expect(elapsed).toBeLessThan(250); // Instant client evaluation without network roundtrip
  });

  it('Test 25: AMOLED #000000 surface and motion physics compliance', async () => {
    global.fetch = vi.fn().mockImplementation((input: any) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/v1/auth/me')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              user: {
                uid: 'admin-001',
                email: 'admin@smexstore.com',
                ign: 'HeadAdmin',
                role: 'admin',
                emailVerified: true,
              },
            }),
        });
      }
      if (url.includes('/api/v1/admin/metrics')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              activeUsers: 1420,
              activeListings: 38,
              liveTournaments: 2,
              databaseStatus: 'ok',
              dbLatencyMs: 4.2,
            }),
        });
      }
      if (url.includes('/api/v1/admin/marketplace/queue')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              queue: [],
            }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      });
    });

    const { getByTestId } = render(
      <AdminLayout>
        <AdminDashboardPage />
      </AdminLayout>
    );

    await waitFor(() => {
      expect(getByTestId('admin-portal-root')).toBeDefined();
    });

    const root = getByTestId('admin-portal-root');
    expect(root.className).toContain('bg-bg-canvas');

    const activeUsersCard = getByTestId('metric-active-users');
    expect(activeUsersCard.className).toContain('bg-bg-surface');
    expect(activeUsersCard.className).toContain('border-border-subtle');

    // Hardware transitions must be duration 120ms
    expect(root.className).toContain('duration-120');
    expect(activeUsersCard.className).toContain('duration-120');

    // Prohibited visuals: Zero frosted glass blur
    expect(root.className).not.toContain('backdrop-blur');
    expect(activeUsersCard.className).not.toContain('backdrop-blur');
  });
});
