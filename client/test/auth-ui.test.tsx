import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { LoginForm } from '../components/auth/LoginForm';
import { RegisterForm } from '../components/auth/RegisterForm';
import { AuthModal } from '../components/auth/AuthModal';
import { Navbar, type UserProfile } from '../components/shell/Navbar';
import { AppShell } from '../components/shell/AppShell';
import { DeviceManagementDashboard, type DeviceSession } from '../app/settings/devices/page';
import authModalSource from '../components/auth/AuthModal.tsx?raw';

describe('Milestone 3: Client Authentication & UI Shell Suite (LLT Tests 24-29)', () => {
  beforeEach(() => {
    cleanup();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('Test 24: Interactive show/hide password visibility toggle (LLT 24)', async () => {
    const { container } = render(<LoginForm />);

    const passwordInput = container.querySelector('#login-password') as HTMLInputElement;
    const toggleButton = container.querySelector('[data-testid="toggle-password-visibility"]') as HTMLButtonElement;

    expect(passwordInput).toBeTruthy();
    expect(toggleButton).toBeTruthy();

    // Initial state: password input type is password
    expect(passwordInput.type).toBe('password');

    // Verify touch target requirements (>= 44px)
    const buttonClass = toggleButton.className;
    expect(buttonClass.includes('min-h-[44px]') && buttonClass.includes('min-w-[44px]')).toBe(true);

    // Simulate click: toggles to text
    fireEvent.click(toggleButton);
    expect(passwordInput.type).toBe('text');

    // Simulate second click: toggles back to password
    fireEvent.click(toggleButton);
    expect(passwordInput.type).toBe('password');
  });

  it('Test 25: Auth form inline validation error states (LLT 25)', async () => {
    const { container } = render(<LoginForm />);

    const form = container.querySelector('form')!;
    const emailInput = container.querySelector('#login-email') as HTMLInputElement;
    const passwordInput = container.querySelector('#login-password') as HTMLInputElement;

    expect(form).toBeTruthy();

    // Submit empty form to trigger initial validation
    fireEvent.submit(form);

    // Check inline validation error renders
    await waitFor(() => {
      expect(container.querySelector('#login-email-error')).toBeTruthy();
      expect(container.querySelector('#login-password-error')).toBeTruthy();
    });

    // Test weak password input (< 8 characters)
    fireEvent.change(emailInput, { target: { value: 'player@smex.gg' } });
    fireEvent.change(passwordInput, { target: { value: 'short' } });
    fireEvent.submit(form);

    await waitFor(() => {
      const updatedPasswordError = container.querySelector('#login-password-error');
      expect(updatedPasswordError).toBeTruthy();
      expect(updatedPasswordError?.textContent?.includes('8 characters')).toBe(true);
    });
  });

  it('Test 26: Navbar user profile dropdown & logout trigger (LLT 26)', async () => {
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

    expect(avatarBadge).toBeTruthy();
    expect(avatarBadge?.getAttribute('data-preset')).toBe('preset_default_01');
    expect(ignDisplay?.textContent?.includes('VortexStriker')).toBe(true);
    expect(unverifiedDot).toBeTruthy();

    // Click profile button to open dropdown
    const profileBtn = container.querySelector('[data-testid="user-profile-button"]') as HTMLButtonElement;
    expect(profileBtn).toBeTruthy();

    fireEvent.click(profileBtn);

    // Verify dropdown contents: unverified email banner, routes, and logout button
    const dropdown = container.querySelector('[data-testid="user-profile-dropdown"]');
    expect(dropdown).toBeTruthy();

    const unverifiedBanner = container.querySelector('[data-testid="unverified-email-banner"]');
    expect(unverifiedBanner).toBeTruthy();
    expect(unverifiedBanner?.textContent?.includes('Email Not Verified')).toBe(true);

    // Check device management link
    const deviceLink = dropdown?.querySelector('a[href="/settings/devices"]');
    expect(deviceLink).toBeTruthy();

    // Click logout
    const logoutBtn = container.querySelector('[data-testid="logout-button"]') as HTMLButtonElement;
    expect(logoutBtn).toBeTruthy();

    fireEvent.click(logoutBtn);

    await waitFor(() => {
      expect(logoutCalled).toBe(true);
    });
  });

  it('Test 27: Device management active sessions rendering (LLT 27)', async () => {
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

    // Mock globalThis.fetch for sessions API
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url: any) => {
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
      expect(cards.length).toBe(2);
    });

    const cards = container.querySelectorAll('[data-testid="device-session-card"]');

    // First card: current device
    const currentCard = cards[0];
    expect(currentCard.getAttribute('data-current')).toBe('true');
    const currentBadge = currentCard.querySelector('[data-testid="current-device-badge"]');
    expect(currentBadge).toBeTruthy();
    expect(currentCard.textContent?.includes('Chrome on Windows 11')).toBe(true);
    expect(currentCard.textContent?.includes('203.0.113.10')).toBe(true);

    // Second card: remote device
    const remoteCard = cards[1];
    expect(remoteCard.getAttribute('data-current')).toBe('false');
    const remoteBadge = remoteCard.querySelector('[data-testid="current-device-badge"]');
    expect(remoteBadge).toBeNull();
    expect(remoteCard.textContent?.includes('Safari on iPhone 15')).toBe(true);

    // Restore fetch
    globalThis.fetch = originalFetch;
  });

  it('Test 28: Remote session revocation & others trigger (LLT 28)', async () => {
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

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url: any, options: any) => {
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
      expect(container.querySelector('[data-testid="revoke-session-button"]')).toBeTruthy();
      expect(container.querySelector('[data-testid="revoke-others-button"]')).toBeTruthy();
    });

    const revokeSingleBtn = container.querySelector('[data-testid="revoke-session-button"]') as HTMLButtonElement;
    fireEvent.click(revokeSingleBtn);

    await waitFor(() => {
      expect(singleRevokeUrl?.includes('/api/v1/devices/sessions/sess_remote_99')).toBe(true);
    });

    const revokeOthersBtn = container.querySelector('[data-testid="revoke-others-button"]') as HTMLButtonElement;
    expect(revokeOthersBtn).toBeTruthy();
    fireEvent.click(revokeOthersBtn);

    await waitFor(() => {
      expect(othersRevokeUrl?.includes('/api/v1/devices/sessions/others')).toBe(true);
    });

    globalThis.fetch = originalFetch;
  });

  it('Test 29: AMOLED modal pure true-black #000000 audit (LLT 29)', async () => {
    // 1. Prohibited: zero #0A0A0A in modal component
    expect(authModalSource.includes('#0A0A0A')).toBe(false);

    // 2. Pure True-Black: AMOLED surface must explicitly use #000000
    expect(authModalSource.includes('#000000')).toBe(true);

    // 3. Prohibited visual effects: zero backdrop-filter blur
    expect(authModalSource.includes('backdrop-blur') || authModalSource.includes('backdrop-filter: blur')).toBe(false);

    // 4. Prohibited animations: zero opacity fade animations
    expect(
      authModalSource.includes('animate-fade') ||
        authModalSource.includes('fade-in') ||
        authModalSource.includes('opacity-0')
    ).toBe(false);

    // 5. Physical transition duration check: <= 120ms
    expect(authModalSource.includes('duration-[120ms]') || authModalSource.includes('duration-[80ms]')).toBe(true);

    // 6. Border specification: #1F1F1F for AMOLED
    expect(authModalSource.includes('#1F1F1F')).toBe(true);
  });

  it('Test 27b: DeviceManagementDashboard reconciles backend payload format with id and lastActiveAt', async () => {
    // Test that client gracefully handles raw backend responses with "id" and "lastActiveAt"
    const backendSessions = [
      {
        id: 'sess_backend_1',
        deviceName: 'Chrome on Windows',
        deviceType: 'desktop',
        ipAddress: '10.0.0.1',
        isCurrent: true,
        lastActiveAt: '2026-10-12T04:00:00.000Z',
        createdAt: '2026-10-12T04:00:00.000Z',
      },
      {
        id: 'sess_backend_2',
        deviceName: 'Safari on iOS',
        deviceType: 'mobile',
        ipAddress: '10.0.0.2',
        isCurrent: false,
        lastActiveAt: '2026-10-12T03:30:00.000Z',
        createdAt: '2026-10-12T03:30:00.000Z',
      },
    ];

    let deleteSessionUrl: string | null = null;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url: any, options: any) => {
      const urlStr = String(url);
      if (options?.method === 'DELETE') {
        deleteSessionUrl = urlStr;
        return { ok: true, json: async () => ({ success: true }) } as any;
      }
      if (urlStr.includes('/api/v1/devices/sessions')) {
        return {
          ok: true,
          json: async () => ({ sessions: backendSessions }),
        } as any;
      }
      return originalFetch(url, options);
    };

    const { container } = render(<DeviceManagementDashboard />);

    await waitFor(() => {
      const cards = container.querySelectorAll('[data-testid="device-session-card"]');
      expect(cards.length).toBe(2);
    });

    // Revoke remote card (sess_backend_2)
    const revokeBtn = container.querySelector('[data-testid="revoke-session-button"]') as HTMLButtonElement;
    expect(revokeBtn).toBeTruthy();
    fireEvent.click(revokeBtn);

    await waitFor(() => {
      expect(deleteSessionUrl?.includes('/api/v1/devices/sessions/sess_backend_2')).toBe(true);
    });

    globalThis.fetch = originalFetch;
  });

  it('Test 26b: Navbar Sign In and Sign Up buttons open AuthModal with respective views', async () => {
    const { container } = render(
      <AppShell>
        <div data-testid="page-child">Home</div>
      </AppShell>
    );

    // Initial state: AuthModal is closed
    let modalSurface = container.querySelector('[data-testid="auth-modal-surface"]');
    expect(modalSurface).toBeNull();

    // Click "Sign In" button
    const signInBtn = container.querySelector('[data-testid="nav-sign-in-button"]') as HTMLButtonElement;
    expect(signInBtn).toBeTruthy();
    fireEvent.click(signInBtn);

    modalSurface = container.querySelector('[data-testid="auth-modal-surface"]');
    expect(modalSurface).toBeTruthy();
    const modalTitle = container.querySelector('#auth-modal-title');
    expect(modalTitle?.textContent).toBe('Sign In');

    // Close the modal
    const closeBtn = container.querySelector('button[aria-label="Close authentication modal"]') as HTMLButtonElement;
    expect(closeBtn).toBeTruthy();
    fireEvent.click(closeBtn);

    modalSurface = container.querySelector('[data-testid="auth-modal-surface"]');
    expect(modalSurface).toBeNull();

    // Click "Sign Up" button
    const signUpBtn = container.querySelector('[data-testid="nav-sign-up-button"]') as HTMLButtonElement;
    expect(signUpBtn).toBeTruthy();
    fireEvent.click(signUpBtn);

    modalSurface = container.querySelector('[data-testid="auth-modal-surface"]');
    expect(modalSurface).toBeTruthy();
    const registerTitle = container.querySelector('#auth-modal-title');
    expect(registerTitle?.textContent).toBe('Create Account');
  });
});
