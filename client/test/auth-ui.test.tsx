import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { JSDOM } from 'jsdom';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Setup JSDOM globals before component imports that may reference window/document
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost:3000',
});
(global as any).window = dom.window;
(global as any).document = dom.window.document;
(global as any).self = dom.window;
Object.defineProperty(global, 'navigator', {
  value: dom.window.navigator,
  configurable: true,
  writable: true,
});
(global as any).HTMLElement = dom.window.HTMLElement;
(global as any).Element = dom.window.Element;
(global as any).Node = dom.window.Node;
(global as any).Event = dom.window.Event;
(global as any).MouseEvent = dom.window.MouseEvent;

// Setup mock localStorage
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
Object.defineProperty(dom.window, 'localStorage', {
  value: localStorageMock,
  configurable: true,
  writable: true,
});
(global as any).localStorage = localStorageMock;

import { render, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { LoginForm } from '../components/auth/LoginForm';
import { RegisterForm } from '../components/auth/RegisterForm';
import { AuthModal } from '../components/auth/AuthModal';
import { Navbar, type UserProfile } from '../components/shell/Navbar';
import { DeviceManagementDashboard, type DeviceSession } from '../app/settings/devices/page';

describe('Milestone 3: Client Authentication & UI Shell Suite (LLT Tests 24-29)', () => {
  beforeEach(() => {
    cleanup();
    document.body.innerHTML = '';
  });

  test('Test 24: Interactive show/hide password visibility toggle (LLT 24)', async () => {
    const { container } = render(<LoginForm />);

    const passwordInput = container.querySelector('#login-password') as HTMLInputElement;
    const toggleButton = container.querySelector('[data-testid="toggle-password-visibility"]') as HTMLButtonElement;

    assert.ok(passwordInput, 'Password input must be present');
    assert.ok(toggleButton, 'Toggle visibility button must be present');

    // Initial state: password input type is password
    assert.strictEqual(passwordInput.type, 'password', 'Initial input type must be password');

    // Verify touch target requirements (>= 44px)
    const buttonClass = toggleButton.className;
    assert.ok(
      buttonClass.includes('min-h-[44px]') && buttonClass.includes('min-w-[44px]'),
      'Password toggle button must meet >= 44px touch target specification'
    );

    // Simulate click: toggles to text
    fireEvent.click(toggleButton);
    assert.strictEqual(passwordInput.type, 'text', 'Input type must switch to text upon toggle click');

    // Simulate second click: toggles back to password
    fireEvent.click(toggleButton);
    assert.strictEqual(passwordInput.type, 'password', 'Input type must switch back to password upon second click');
  });

  test('Test 25: Auth form inline validation error states (LLT 25)', async () => {
    const { container } = render(<LoginForm />);

    const form = container.querySelector('form')!;
    const emailInput = container.querySelector('#login-email') as HTMLInputElement;
    const passwordInput = container.querySelector('#login-password') as HTMLInputElement;

    assert.ok(form, 'Login form must be present');

    // Submit empty form to trigger initial validation
    fireEvent.submit(form);

    // Check inline validation error renders
    await waitFor(() => {
      assert.ok(container.querySelector('#login-email-error'), 'Email error must be displayed');
      assert.ok(container.querySelector('#login-password-error'), 'Password error must be displayed');
    });

    // Test weak password input (< 8 characters)
    fireEvent.change(emailInput, { target: { value: 'player@smex.gg' } });
    fireEvent.change(passwordInput, { target: { value: 'short' } });
    fireEvent.submit(form);

    await waitFor(() => {
      const updatedPasswordError = container.querySelector('#login-password-error');
      assert.ok(updatedPasswordError, 'Password complexity error must be displayed for weak password');
      assert.ok(
        updatedPasswordError.textContent?.includes('8 characters'),
        'Error message must specify 8 characters requirement'
      );
    });
  });

  test('Test 26: Navbar user profile dropdown & logout trigger (LLT 26)', async () => {
    let logoutCalled = false;
    const mockUser: UserProfile = {
      id: 'usr_test_123',
      email: 'gamer@smex.gg',
      inGameId: 'VortexStriker',
      avatarPreset: 'preset_default_01',
      emailVerified: false,
    };

    const { container } = render(
      <Navbar
        user={mockUser}
        onLogout={() => {
          logoutCalled = true;
        }}
      />
    );

    // Verify avatar preset badge and IGN
    const avatarBadge = container.querySelector('[data-testid="user-avatar-badge"]');
    const ignDisplay = container.querySelector('[data-testid="user-ign"]');
    const unverifiedDot = container.querySelector('[data-testid="unverified-email-dot"]');

    assert.ok(avatarBadge, 'User avatar preset badge must be rendered');
    assert.strictEqual(
      avatarBadge?.getAttribute('data-preset'),
      'preset_default_01',
      'Avatar badge must have preset_default_01'
    );
    assert.ok(ignDisplay?.textContent?.includes('VortexStriker'), 'IGN must match user inGameId');
    assert.ok(unverifiedDot, 'Unverified email warning indicator dot must be present');

    // Click profile button to open dropdown
    const profileBtn = container.querySelector('[data-testid="user-profile-button"]') as HTMLButtonElement;
    assert.ok(profileBtn, 'Profile trigger button must exist');

    fireEvent.click(profileBtn);

    // Verify dropdown contents: unverified email banner, routes, and logout button
    const dropdown = container.querySelector('[data-testid="user-profile-dropdown"]');
    assert.ok(dropdown, 'Profile dropdown menu must be open');

    const unverifiedBanner = container.querySelector('[data-testid="unverified-email-banner"]');
    assert.ok(unverifiedBanner, 'Unverified email warning banner must be visible in dropdown');
    assert.ok(unverifiedBanner?.textContent?.includes('Email Not Verified'));

    // Check device management link
    const deviceLink = dropdown?.querySelector('a[href="/settings/devices"]');
    assert.ok(deviceLink, 'Dropdown must contain link to /settings/devices');

    // Click logout
    const logoutBtn = container.querySelector('[data-testid="logout-button"]') as HTMLButtonElement;
    assert.ok(logoutBtn, 'Logout button must be present in dropdown');

    fireEvent.click(logoutBtn);

    await waitFor(() => {
      assert.strictEqual(logoutCalled, true, 'onLogout callback must be triggered on logout click');
    });
  });

  test('Test 27: Device management active sessions rendering (LLT 27)', async () => {
    const mockSessions: DeviceSession[] = [
      {
        sessionId: 'sess_1',
        deviceType: 'desktop',
        deviceName: 'Chrome on Windows 11',
        ipAddress: '203.0.113.10',
        location: 'Mumbai, India',
        isCurrent: true,
        createdAt: '2026-10-11T10:00:00Z',
      },
      {
        sessionId: 'sess_2',
        deviceType: 'mobile',
        deviceName: 'Safari on iPhone 15',
        ipAddress: '198.51.100.25',
        location: 'Delhi, India',
        isCurrent: false,
        createdAt: '2026-10-10T14:30:00Z',
      },
    ];

    // Mock global fetch for sessions API
    const originalFetch = global.fetch;
    global.fetch = async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/v1/devices/sessions')) {
        return {
          ok: true,
          json: async () => ({ sessions: mockSessions }),
        } as any;
      }
      return originalFetch(url);
    };

    const { container } = render(<DeviceManagementDashboard />);

    await waitFor(() => {
      const cards = container.querySelectorAll('[data-testid="device-session-card"]');
      assert.strictEqual(cards.length, 2, 'Must render 2 device session cards');
    });

    const cards = container.querySelectorAll('[data-testid="device-session-card"]');

    // First card: current device
    const currentCard = cards[0];
    assert.strictEqual(currentCard.getAttribute('data-current'), 'true');
    const currentBadge = currentCard.querySelector('[data-testid="current-device-badge"]');
    assert.ok(currentBadge, 'Current session must display "Current Device" badge');
    assert.ok(currentCard.textContent?.includes('Chrome on Windows 11'));
    assert.ok(currentCard.textContent?.includes('203.0.113.10'));

    // Second card: remote device
    const remoteCard = cards[1];
    assert.strictEqual(remoteCard.getAttribute('data-current'), 'false');
    const remoteBadge = remoteCard.querySelector('[data-testid="current-device-badge"]');
    assert.strictEqual(remoteBadge, null, 'Remote session must NOT have "Current Device" badge');
    assert.ok(remoteCard.textContent?.includes('Safari on iPhone 15'));

    // Restore fetch
    global.fetch = originalFetch;
  });

  test('Test 28: Remote session revocation & others trigger (LLT 28)', async () => {
    let singleRevokeUrl: string | null = null;
    let othersRevokeUrl: string | null = null;

    const mockSessions: DeviceSession[] = [
      {
        sessionId: 'sess_current',
        deviceType: 'desktop',
        deviceName: 'Desktop App',
        ipAddress: '127.0.0.1',
        isCurrent: true,
        createdAt: '2026-10-11T10:00:00Z',
      },
      {
        sessionId: 'sess_remote_99',
        deviceType: 'mobile',
        deviceName: 'Android Chrome',
        ipAddress: '10.0.0.5',
        isCurrent: false,
        createdAt: '2026-10-09T08:00:00Z',
      },
      {
        sessionId: 'sess_remote_100',
        deviceType: 'desktop',
        deviceName: 'Work Mac',
        ipAddress: '10.0.0.6',
        isCurrent: false,
        createdAt: '2026-10-08T08:00:00Z',
      },
    ];

    const originalFetch = global.fetch;
    global.fetch = async (url: any, options: any) => {
      const urlStr = String(url);
      if (options?.method === 'DELETE') {
        if (urlStr.includes('/others')) {
          othersRevokeUrl = urlStr;
          return { ok: true, json: async () => ({ success: true }) } as any;
        }
        if (urlStr.includes('/sess_remote_99')) {
          singleRevokeUrl = urlStr;
          return { ok: true, json: async () => ({ success: true }) } as any;
        }
      }
      if (urlStr.includes('/api/v1/devices/sessions')) {
        return {
          ok: true,
          json: async () => ({ sessions: mockSessions }),
        } as any;
      }
      return originalFetch(url, options);
    };

    const { container } = render(<DeviceManagementDashboard />);

    // Wait for the sessions to load and the revoke button to be in document
    await waitFor(() => {
      assert.ok(container.querySelector('[data-testid="revoke-session-button"]'), 'Revoke button must appear');
      assert.ok(container.querySelector('[data-testid="revoke-others-button"]'), 'Revoke others button must appear');
    });

    const revokeSingleBtn = container.querySelector('[data-testid="revoke-session-button"]') as HTMLButtonElement;
    fireEvent.click(revokeSingleBtn);

    await waitFor(() => {
      assert.ok(
        singleRevokeUrl?.includes('/api/v1/devices/sessions/sess_remote_99'),
        'Clicking Revoke must dispatch DELETE /api/v1/devices/sessions/:sessionId'
      );
    });

    const revokeOthersBtn = container.querySelector('[data-testid="revoke-others-button"]') as HTMLButtonElement;
    assert.ok(revokeOthersBtn, 'Revoke All Other Sessions button must exist');
    fireEvent.click(revokeOthersBtn);

    await waitFor(() => {
      assert.ok(
        othersRevokeUrl?.includes('/api/v1/devices/sessions/others'),
        'Clicking Revoke Others must dispatch DELETE /api/v1/devices/sessions/others'
      );
    });

    global.fetch = originalFetch;
  });

  test('Test 29: AMOLED modal pure true-black #000000 audit (LLT 29)', async () => {
    const modalFilePath = path.resolve(__dirname, '../components/auth/AuthModal.tsx');
    const modalContent = fs.readFileSync(modalFilePath, 'utf-8');

    // 1. Prohibited: zero #0A0A0A in modal component
    assert.strictEqual(
      modalContent.includes('#0A0A0A'),
      false,
      'Prohibited color token #0A0A0A detected in AuthModal; must use pure #000000 for AMOLED'
    );

    // 2. Pure True-Black: AMOLED surface must explicitly use #000000
    assert.ok(
      modalContent.includes('#000000'),
      'AuthModal must specify pure true-black #000000 for AMOLED mode'
    );

    // 3. Prohibited visual effects: zero backdrop-filter blur
    assert.strictEqual(
      modalContent.includes('backdrop-blur') || modalContent.includes('backdrop-filter: blur'),
      false,
      'Prohibited effect: backdrop-filter blur must be zero'
    );

    // 4. Prohibited animations: zero opacity fade animations
    assert.strictEqual(
      modalContent.includes('animate-fade') ||
        modalContent.includes('fade-in') ||
        modalContent.includes('opacity-0'),
      false,
      'Prohibited animation: opacity fade animations must not be used on AuthModal'
    );

    // 5. Physical transition duration check: <= 120ms
    assert.ok(
      modalContent.includes('duration-[120ms]') || modalContent.includes('duration-[80ms]'),
      'Modal transitions must adhere to physical duration limits (<= 120ms)'
    );

    // 6. Border specification: #1F1F1F for AMOLED
    assert.ok(
      modalContent.includes('#1F1F1F'),
      'AuthModal must specify subtle #1F1F1F border for AMOLED contrast'
    );
  });
});
