import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { LoginForm } from '../components/auth/LoginForm';
import { RegisterForm } from '../components/auth/RegisterForm';
import { ResetPasswordForm } from '../components/auth/ResetPasswordForm';
import { AuthModal } from '../components/auth/AuthModal';
import { Navbar } from '../components/shell/Navbar';
import { type UserProfile } from '@smex/shared';
import { AppShell } from '../components/shell/AppShell';
import DeviceManagementDashboard, { type DeviceSession } from '../app/settings/devices/page';
import VerifyEmailPage from '../app/verify-email/page';
import ResetPasswordPage from '../app/reset-password/page';
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
      uid: 'usr_test_123',
      email: 'gamer@smex.gg',
      ign: 'VortexStriker',
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

    const uidDisplay = container.querySelector('[data-testid="user-uid"]');
    expect(uidDisplay).toBeTruthy();
    expect(uidDisplay?.textContent?.includes('usr_test_123')).toBe(true);

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

  it('Test 30b: Theme and density hydration from localStorage on mount (BUG-M2-003)', async () => {
    localStorage.setItem('smex_theme', 'amoled');
    localStorage.setItem('smex_density', 'compact');

    render(<Navbar />);

    await waitFor(() => {
      expect(document.documentElement.getAttribute('data-theme')).toBe('amoled');
      expect(document.documentElement.getAttribute('data-density')).toBe('compact');
    });

    localStorage.removeItem('smex_theme');
    localStorage.removeItem('smex_density');
  });

  it('Test 25b: RegisterForm validates username and sends username payload (BUG-M3-002)', async () => {
    let capturedBody: any = null;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url: any, options: any) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/v1/auth/register') && options?.method === 'POST') {
        capturedBody = JSON.parse(options.body);
        return {
          ok: true,
          json: async () => ({
            id: 'usr_new',
            email: capturedBody.email,
            emailVerified: false,
            profile: { username: capturedBody.username },
          }),
        } as any;
      }
      return originalFetch(url, options);
    };

    const { container } = render(<RegisterForm />);

    const form = container.querySelector('form')!;
    const emailInput = container.querySelector('#reg-email') as HTMLInputElement;
    const usernameInput = container.querySelector('#reg-username') as HTMLInputElement;
    const passwordInput = container.querySelector('#reg-password') as HTMLInputElement;
    const confirmPasswordInput = container.querySelector('#reg-confirm-password') as HTMLInputElement;

    expect(usernameInput).toBeTruthy();

    // Fill valid registration fields with username
    fireEvent.change(emailInput, { target: { value: 'newplayer@smexstore.com' } });
    fireEvent.change(usernameInput, { target: { value: 'ApexPredator' } });
    fireEvent.change(passwordInput, { target: { value: 'Password123!' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'Password123!' } });

    fireEvent.submit(form);

    await waitFor(() => {
      expect(capturedBody).toEqual({
        email: 'newplayer@smexstore.com',
        username: 'ApexPredator',
        password: 'Password123!',
      });
      expect(container.textContent?.includes('Account Created')).toBe(true);
    });

    globalThis.fetch = originalFetch;
  });

  it('Test 25c: LoginForm persists access token to localStorage and triggers onSuccess (BUG-M3-003)', async () => {
    let capturedBody: any = null;
    let capturedOptions: any = null;
    let successUser: any = null;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url: any, options: any) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/v1/auth/login') && options?.method === 'POST') {
        capturedBody = JSON.parse(options.body);
        capturedOptions = options;
        return {
          ok: true,
          json: async () => ({
            accessToken: 'test_access_jwt_789',
            tokenType: 'Bearer',
            expiresIn: 900,
            user: {
              id: 'usr_login_1',
              email: capturedBody.email,
              role: 'user',
              emailVerified: true,
            },
          }),
        } as any;
      }
      return originalFetch(url, options);
    };

    const { container } = render(
      <LoginForm
        onSuccess={(user) => {
          successUser = user;
        }}
      />
    );

    const form = container.querySelector('form')!;
    const emailInput = container.querySelector('#login-email') as HTMLInputElement;
    const passwordInput = container.querySelector('#login-password') as HTMLInputElement;

    fireEvent.change(emailInput, { target: { value: 'player@smexstore.com' } });
    fireEvent.change(passwordInput, { target: { value: 'Password123!' } });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(capturedOptions?.credentials).toBe('include');
      expect(localStorage.getItem('smex_auth_token')).toBe('test_access_jwt_789');
      expect(successUser).toEqual({
        id: 'usr_login_1',
        email: 'player@smexstore.com',
        role: 'user',
        emailVerified: true,
      });
    });

    localStorage.removeItem('smex_auth_token');
    globalThis.fetch = originalFetch;
  });

  it('Test 26c: AppShell bootstraps session via /api/v1/auth/me when token exists and updates state (BUG-M3-003)', async () => {
    localStorage.setItem('smex_auth_token', 'bootstrap_token_456');

    let meAuthHeader: string | null = null;
    let meCredentials: any = null;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url: any, options: any) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/v1/auth/me')) {
        const headers = new Headers(options?.headers);
        meAuthHeader = headers.get('authorization');
        meCredentials = options?.credentials;
        return {
          ok: true,
          json: async () => ({
            id: 'usr_bootstrapped',
            email: 'captain@smexstore.com',
            role: 'user',
            emailVerified: true,
            sessionId: 'sess_active_1',
            profile: {
              username: 'CaptainSmex',
              avatarPreset: 'preset_default_01',
              themePref: 'dark',
              densityPref: 'comfortable',
            },
          }),
        } as any;
      }
      return originalFetch(url, options);
    };

    const { container } = render(
      <AppShell>
        <div data-testid="page-child">Protected App Shell Content</div>
      </AppShell>
    );

    await waitFor(() => {
      expect(meAuthHeader).toBe('Bearer bootstrap_token_456');
      expect(meCredentials).toBe('include');
      const profileButton = container.querySelector('[data-testid="user-profile-button"]');
      expect(profileButton).toBeTruthy();
      expect(container.querySelector('[data-testid="user-ign"]')?.textContent).toBe('CaptainSmex');
    });

    localStorage.removeItem('smex_auth_token');
    globalThis.fetch = originalFetch;
  });

  it('Test 27c: DeviceManagementDashboard attaches Authorization header and credentials (BUG-M3-003)', async () => {
    localStorage.setItem('smex_auth_token', 'devices_dashboard_token');

    let sessionsAuthHeader: string | null = null;
    let sessionsCredentials: any = null;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url: any, options: any) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/v1/devices/sessions')) {
        const headers = new Headers(options?.headers);
        sessionsAuthHeader = headers.get('authorization');
        sessionsCredentials = options?.credentials;
        return {
          ok: true,
          json: async () => ({
            sessions: [
              {
                id: 'sess_authenticated_1',
                deviceName: 'Authenticated Device',
                deviceType: 'desktop',
                ipAddress: '127.0.0.1',
                isCurrent: true,
                createdAt: '2026-10-13T00:00:00.000Z',
              },
            ],
          }),
        } as any;
      }
      return originalFetch(url, options);
    };

    const { container } = render(<DeviceManagementDashboard />);

    await waitFor(() => {
      expect(sessionsAuthHeader).toBe('Bearer devices_dashboard_token');
      expect(sessionsCredentials).toBe('include');
      const cards = container.querySelectorAll('[data-testid="device-session-card"]');
      expect(cards.length).toBe(1);
    });

    localStorage.removeItem('smex_auth_token');
    globalThis.fetch = originalFetch;
  });

  it('Test 25d: ResetPasswordForm validates password match and submits token payload (BUG-M3-004)', async () => {
    let capturedBody: any = null;
    let successTriggered = false;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url: any, options: any) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/v1/auth/reset-password') && options?.method === 'POST') {
        capturedBody = JSON.parse(options.body);
        return {
          ok: true,
          json: async () => ({
            success: true,
            message: 'Password updated successfully',
          }),
        } as any;
      }
      return originalFetch(url, options);
    };

    const { container } = render(
      <ResetPasswordForm
        token="reset_token_valid_123"
        onSuccess={() => {
          successTriggered = true;
        }}
      />
    );

    const form = container.querySelector('form')!;
    const newPasswordInput = container.querySelector('#reset-new-password') as HTMLInputElement;
    const confirmPasswordInput = container.querySelector('#reset-confirm-password') as HTMLInputElement;

    // Test mismatched passwords
    fireEvent.change(newPasswordInput, { target: { value: 'ValidPass123!' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'MismatchedPass123!' } });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(container.querySelector('#reset-confirm-password-error')).toBeTruthy();
      expect(container.querySelector('#reset-confirm-password-error')?.textContent?.includes('match')).toBe(true);
    });

    // Test matching valid passwords
    fireEvent.change(confirmPasswordInput, { target: { value: 'ValidPass123!' } });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(capturedBody).toEqual({
        token: 'reset_token_valid_123',
        newPassword: 'ValidPass123!',
      });
      expect(successTriggered).toBe(true);
      expect(container.querySelector('[data-testid="reset-success-screen"]')).toBeTruthy();
    });

    globalThis.fetch = originalFetch;
  });

  it('Test 25e: ResetPasswordForm interactive show/hide password visibility toggles (BUG-M3-004)', async () => {
    const { container } = render(<ResetPasswordForm token="test_token" />);

    const newPasswordInput = container.querySelector('#reset-new-password') as HTMLInputElement;
    const confirmPasswordInput = container.querySelector('#reset-confirm-password') as HTMLInputElement;
    const toggleNewBtn = container.querySelector('[data-testid="toggle-password-visibility"]') as HTMLButtonElement;
    const toggleConfirmBtn = container.querySelector('[data-testid="toggle-confirm-password-visibility"]') as HTMLButtonElement;

    expect(newPasswordInput.type).toBe('password');
    expect(confirmPasswordInput.type).toBe('password');

    // Toggle new password
    fireEvent.click(toggleNewBtn);
    expect(newPasswordInput.type).toBe('text');
    fireEvent.click(toggleNewBtn);
    expect(newPasswordInput.type).toBe('password');

    // Toggle confirm password
    fireEvent.click(toggleConfirmBtn);
    expect(confirmPasswordInput.type).toBe('text');
    fireEvent.click(toggleConfirmBtn);
    expect(confirmPasswordInput.type).toBe('password');
  });

  it('Test 25f: VerifyEmailPage renders and handles missing token gracefully (BUG-M3-004)', async () => {
    const { container } = render(<VerifyEmailPage />);

    // In isolated test without ?token query param, renders missing token warning
    await waitFor(() => {
      const missingTokenCard = container.querySelector('[data-testid="missing-token-card"]');
      expect(missingTokenCard).toBeTruthy();
      expect(missingTokenCard?.textContent?.includes('Missing Verification Token')).toBe(true);
    });
  });

  it('Test 25g: ResetPasswordPage renders security card and handles missing token gracefully (BUG-M3-004)', async () => {
    const { container } = render(<ResetPasswordPage />);

    // In isolated test without ?token query param, renders missing reset token warning
    await waitFor(() => {
      const missingTokenCard = container.querySelector('[data-testid="missing-token-card"]');
      expect(missingTokenCard).toBeTruthy();
      expect(missingTokenCard?.textContent?.includes('Invalid Reset Link')).toBe(true);
    });
  });

  it('Test 25h: AuthModal does not prematurely dismiss on registration success and displays Account Created view (BUG-M3-005)', async () => {
    let modalClosed = false;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url: any, options: any) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/v1/auth/register') && options?.method === 'POST') {
        const body = JSON.parse(options.body);
        return {
          ok: true,
          json: async () => ({
            id: 'usr_new_1',
            email: body.email,
            emailVerified: false,
            profile: { username: body.username },
          }),
        } as any;
      }
      return originalFetch(url, options);
    };

    const { container } = render(
      <AuthModal
        isOpen={true}
        initialView="register"
        onClose={() => {
          modalClosed = true;
        }}
      />
    );

    const emailInput = container.querySelector('#reg-email') as HTMLInputElement;
    const usernameInput = container.querySelector('#reg-username') as HTMLInputElement;
    const passwordInput = container.querySelector('#reg-password') as HTMLInputElement;
    const confirmPasswordInput = container.querySelector('#reg-confirm-password') as HTMLInputElement;
    const form = container.querySelector('form')!;

    fireEvent.change(emailInput, { target: { value: 'retainmodal@smex.gg' } });
    fireEvent.change(usernameInput, { target: { value: 'RetainModal' } });
    fireEvent.change(passwordInput, { target: { value: 'Password123!' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'Password123!' } });
    fireEvent.submit(form);

    // Modal should NOT be closed; confirmation screen must be visible
    await waitFor(() => {
      expect(container.textContent?.includes('Account Created')).toBe(true);
      expect(container.textContent?.includes('We have dispatched a verification link')).toBe(true);
      expect(modalClosed).toBe(false);
    });

    // Clicking "Continue to Sign In" switches the view to Sign In without closing
    const continueBtn = container.querySelector('button.mt-2') as HTMLButtonElement;
    expect(continueBtn).toBeTruthy();
    fireEvent.click(continueBtn);

    await waitFor(() => {
      expect(container.querySelector('#auth-modal-title')?.textContent).toBe('Sign In');
      expect(modalClosed).toBe(false);
    });

    globalThis.fetch = originalFetch;
  });

  it('Test 25i: AuthModal does not prematurely dismiss on forgot password submission and displays Reset Link Dispatched view (BUG-M3-005)', async () => {
    let modalClosed = false;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url: any, options: any) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/v1/auth/forgot-password') && options?.method === 'POST') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            message: 'If an account exists, a link was sent',
          }),
        } as any;
      }
      return originalFetch(url, options);
    };

    const { container } = render(
      <AuthModal
        isOpen={true}
        initialView="forgot-password"
        onClose={() => {
          modalClosed = true;
        }}
      />
    );

    const emailInput = container.querySelector('#forgot-email') as HTMLInputElement;
    const form = container.querySelector('form')!;

    fireEvent.change(emailInput, { target: { value: 'forgotplayer@smex.gg' } });
    fireEvent.submit(form);

    // Modal should NOT be closed; confirmation screen must be visible
    await waitFor(() => {
      expect(container.textContent?.includes('Reset Link Dispatched')).toBe(true);
      expect(modalClosed).toBe(false);
    });

    // Clicking "Back to Sign In" switches view to Sign In without closing
    const backBtn = container.querySelector('button.mt-2') as HTMLButtonElement;
    expect(backBtn).toBeTruthy();
    fireEvent.click(backBtn);

    await waitFor(() => {
      expect(container.querySelector('#auth-modal-title')?.textContent).toBe('Sign In');
      expect(modalClosed).toBe(false);
    });

    globalThis.fetch = originalFetch;
  });
});
