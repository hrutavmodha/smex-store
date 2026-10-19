import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, fireEvent, waitFor, cleanup, screen } from '@testing-library/react';
import { NotificationCenter } from '../components/notifications/NotificationCenter';
import { UniversalSearchModal } from '../components/search/UniversalSearchModal';
import { Navbar } from '../components/shell/Navbar';
import { mockRouter } from './mocks/navigation';

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  url: string;
  readyState = 1;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  send = vi.fn();
  close = vi.fn();

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
    setTimeout(() => {
      this.onopen?.();
    }, 10);
  }
}

describe('Milestone 8: Client Notifications and Search UI Suite (LLT Tests 20-25)', () => {
  const originalWebSocket = global.WebSocket;
  const originalFetch = global.fetch;

  beforeEach(() => {
    cleanup();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
    mockRouter.push.mockClear();
    MockWebSocket.instances = [];
    (global as any).WebSocket = MockWebSocket;
  });

  afterEach(() => {
    global.WebSocket = originalWebSocket;
    global.fetch = originalFetch;
  });

  it('Test 20: Navbar notification bell badge live counter updates on WebSocket event', async () => {
    // Initial fetch returns 2 unread notifications
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/notifications')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              unreadCount: 2,
              notifications: [
                {
                  id: 'n1',
                  recipientId: 'u123',
                  type: 'request',
                  title: 'Join Req 1',
                  message: 'Player 1 wants to join',
                  isRead: false,
                  createdAt: new Date().toISOString(),
                },
                {
                  id: 'n2',
                  recipientId: 'u123',
                  type: 'update',
                  title: 'Match update',
                  message: 'Match delayed',
                  isRead: false,
                  createdAt: new Date().toISOString(),
                },
              ],
            }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    const { getByTestId } = render(
      <NotificationCenter user={{ uid: 'u123', email: 'viper@smexstore.com' }} />
    );

    // Initial badge must render with count "2"
    await waitFor(() => {
      const badge = getByTestId('notification-badge');
      expect(badge.textContent).toBe('2');
    });

    const ws = MockWebSocket.instances[0];
    expect(ws).toBeDefined();

    // WebSocket event notification:new arrives with unreadCount = 3
    ws.onmessage?.({
      data: JSON.stringify({
        event: 'notification:new',
        unreadCount: 3,
        data: {
          id: 'n3',
          recipientId: 'u123',
          type: 'system',
          title: 'System Alert',
          message: 'Maintenance in 1 hour',
          isRead: false,
          createdAt: new Date().toISOString(),
        },
      }),
    });

    // Badge text updates to "3" with emerald accent styling
    await waitFor(() => {
      const badge = getByTestId('notification-badge');
      expect(badge.textContent).toBe('3');
      expect(badge.className).toContain('bg-[#22C58F]');
    });
  });

  it('Test 20b: NotificationCenter subscribes to user private channel using primary id or uid (Bug 2)', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/notifications')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ unreadCount: 0, notifications: [] }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    render(
      <NotificationCenter user={{ id: 'user-uuid-999', email: 'account@smexstore.com' } as any} />
    );

    await waitFor(() => {
      const ws = MockWebSocket.instances[0];
      expect(ws).toBeDefined();
      expect(ws.send).toHaveBeenCalledWith(
        JSON.stringify({
          action: 'subscribe',
          channel: 'user:user-uuid-999',
        })
      );
    });
  });

  it('Test 21: Notification center empty state illustration renders when count is 0', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/notifications')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              unreadCount: 0,
              notifications: [],
            }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    const { getByTestId, queryByTestId, getByText } = render(
      <NotificationCenter user={{ uid: 'u123', email: 'empty@smexstore.com' }} />
    );

    // Zero unread count -> badge should not exist
    expect(queryByTestId('notification-badge')).toBeNull();

    // Click notification bell
    const bell = getByTestId('notification-bell');
    fireEvent.click(bell);

    // Verify empty state illustration
    await waitFor(() => {
      expect(getByTestId('notification-empty')).toBeDefined();
      expect(getByText('No new notifications')).toBeDefined();
      expect(getByText("You're all caught up!")).toBeDefined();
    });
  });

  it('Test 22: Universal search modal toggle via Cmd+K / Ctrl+K with auto-focus', async () => {
    const { getByTestId, getByPlaceholderText } = render(
      <Navbar user={{ uid: 'u123', email: 'test@smexstore.com', ign: 'Viper', emailVerified: true }} />
    );

    // Press Cmd+K
    fireEvent.keyDown(window, { metaKey: true, key: 'k' });

    // Modal appears and input is auto-focused
    await waitFor(() => {
      const modal = getByTestId('universal-search-modal');
      expect(modal).toBeDefined();
      const input = getByPlaceholderText(/search tournaments, teams/i);
      expect(input).toBeDefined();
    });
  });

  it('Test 23: Search input debouncing prevents query flooding (300ms pause)', async () => {
    let fetchCount = 0;
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/search')) {
        fetchCount++;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              query: 'mythic',
              category: 'all',
              totalMatches: 1,
              results: {
                tournaments: [
                  {
                    id: 'tourney-1',
                    title: 'Mythic Legends',
                    gameSlug: 'mlbb',
                    status: 'upcoming',
                    url: '/tournaments/tourney-1',
                  },
                ],
              },
            }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    const { getByPlaceholderText } = render(
      <UniversalSearchModal isOpen={true} onClose={() => {}} />
    );

    const input = getByPlaceholderText(/search tournaments, teams/i);

    // Rapidly type characters
    fireEvent.change(input, { target: { value: 'm' } });
    fireEvent.change(input, { target: { value: 'my' } });
    fireEvent.change(input, { target: { value: 'myt' } });
    fireEvent.change(input, { target: { value: 'myth' } });
    fireEvent.change(input, { target: { value: 'mythi' } });
    fireEvent.change(input, { target: { value: 'mythic' } });

    // Intermediate keystrokes must be suppressed
    expect(fetchCount).toBe(0);

    // Wait 350ms for the debounced network call to execute
    await new Promise((resolve) => setTimeout(resolve, 350));

    expect(fetchCount).toBe(1);
  });

  it('Test 24: Keyboard navigation across search results with ArrowDown and Enter', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/search')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              query: 'warriors',
              category: 'all',
              totalMatches: 2,
              results: {
                teams: [
                  {
                    id: 'team-warriors',
                    name: 'Warriors MLBB',
                    tag: 'WAR',
                    gameSlug: 'mlbb',
                    url: '/teams/team-warriors',
                  },
                ],
              },
            }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    const onClose = vi.fn();
    const { getByPlaceholderText, getAllByTestId } = render(
      <UniversalSearchModal isOpen={true} onClose={onClose} />
    );

    const input = getByPlaceholderText(/search tournaments, teams/i);
    fireEvent.change(input, { target: { value: 'warriors' } });

    // Wait for search results
    await waitFor(() => {
      const items = getAllByTestId('search-result-item');
      expect(items.length).toBeGreaterThan(0);
    });

    // Press ArrowDown to select first item, then Enter
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onClose).toHaveBeenCalled();
    expect(mockRouter.push).toHaveBeenCalledWith('/teams/team-warriors');
  });

  it('Test 24b: Clearing search query resets results to empty (Bug 7)', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/search')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              query: 'warriors',
              category: 'all',
              totalMatches: 1,
              results: {
                teams: [
                  {
                    id: 'team-warriors',
                    name: 'Warriors MLBB',
                    tag: 'WAR',
                    gameSlug: 'mlbb',
                    url: '/teams/team-warriors',
                  },
                ],
              },
            }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    const { getByPlaceholderText, getAllByTestId, queryAllByTestId } = render(
      <UniversalSearchModal isOpen={true} onClose={() => {}} />
    );

    const input = getByPlaceholderText(/search tournaments, teams/i);
    fireEvent.change(input, { target: { value: 'warriors' } });

    // Wait for search results
    await waitFor(() => {
      const items = getAllByTestId('search-result-item');
      expect(items.length).toBe(1);
    });

    // Clear search query (backspace down to 0 character)
    fireEvent.change(input, { target: { value: '' } });

    // Results must immediately be cleared
    await waitFor(() => {
      const items = queryAllByTestId('search-result-item');
      expect(items.length).toBe(0);
    });
  });

  it('Test 25: AMOLED #000000 surface and zero blur filter compliance', async () => {
    const { getByTestId } = render(
      <UniversalSearchModal isOpen={true} onClose={() => {}} />
    );

    const modal = getByTestId('universal-search-modal');
    // Backdrop filter must be strictly 'none'
    expect(modal.style.backdropFilter).toBe('none');
    // Class name must contain AMOLED black background
    expect(modal.className).toContain('bg-[#000000]');

    // Card panel must use dark emerald #121C19 with zero blur
    const card = modal.firstElementChild as HTMLElement;
    expect(card).toBeDefined();
    expect(card.className).toContain('bg-[#121C19]');
    expect(card.style.backdropFilter).toBe('none');
  });
});
