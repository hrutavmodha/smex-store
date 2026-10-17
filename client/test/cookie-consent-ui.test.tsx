import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { CookieConsentBanner } from '../components/shell/CookieConsentBanner';
import { COOKIE_CONSENT_KEY } from '@smex/shared';

describe('Cookie Consent Banner Suite', () => {
  beforeEach(() => {
    cleanup();
    localStorage.removeItem(COOKIE_CONSENT_KEY);
  });

  afterEach(() => {
    localStorage.removeItem(COOKIE_CONSENT_KEY);
  });

  it('renders banner on initial load when consent is absent', async () => {
    const { getByTestId } = render(<CookieConsentBanner />);

    await waitFor(() => {
      expect(getByTestId('cookie-consent-banner')).toBeDefined();
    });
  });

  it('does not render if consent has already been accepted', async () => {
    localStorage.setItem(
      COOKIE_CONSENT_KEY,
      JSON.stringify({ necessary: true, preferences: true, analytics: true, version: '1.0.0' })
    );

    const { queryByTestId } = render(<CookieConsentBanner />);

    // Wait short delay to ensure it stays null
    await new Promise((r) => setTimeout(r, 60));
    expect(queryByTestId('cookie-consent-banner')).toBeNull();
  });

  it('clicking Accept All saves preferences and dismisses banner', async () => {
    const { getByTestId, queryByTestId } = render(<CookieConsentBanner />);

    await waitFor(() => {
      expect(getByTestId('cookie-consent-banner')).toBeDefined();
    });

    fireEvent.click(getByTestId('cookie-accept-all'));

    await waitFor(() => {
      expect(queryByTestId('cookie-consent-banner')).toBeNull();
    });

    const stored = JSON.parse(localStorage.getItem(COOKIE_CONSENT_KEY) || '{}');
    expect(stored.necessary).toBe(true);
    expect(stored.preferences).toBe(true);
    expect(stored.analytics).toBe(true);
  });

  it('clicking Reject Non-Essential saves necessary-only consent', async () => {
    const { getByTestId, queryByTestId } = render(<CookieConsentBanner />);

    await waitFor(() => {
      expect(getByTestId('cookie-consent-banner')).toBeDefined();
    });

    fireEvent.click(getByTestId('cookie-reject-all'));

    await waitFor(() => {
      expect(queryByTestId('cookie-consent-banner')).toBeNull();
    });

    const stored = JSON.parse(localStorage.getItem(COOKIE_CONSENT_KEY) || '{}');
    expect(stored.necessary).toBe(true);
    expect(stored.preferences).toBe(false);
    expect(stored.analytics).toBe(false);
  });

  it('allows customizing specific preferences before saving', async () => {
    const { getByTestId, queryByTestId } = render(<CookieConsentBanner />);

    await waitFor(() => {
      expect(getByTestId('cookie-consent-banner')).toBeDefined();
    });

    // Expand customize view
    fireEvent.click(getByTestId('cookie-customize'));

    await waitFor(() => {
      expect(getByTestId('cookie-pref-functional')).toBeDefined();
      expect(getByTestId('cookie-pref-analytics')).toBeDefined();
    });

    // Uncheck analytics
    fireEvent.click(getByTestId('cookie-pref-analytics'));

    // Save preferences
    fireEvent.click(getByTestId('cookie-customize'));

    await waitFor(() => {
      expect(queryByTestId('cookie-consent-banner')).toBeNull();
    });

    const stored = JSON.parse(localStorage.getItem(COOKIE_CONSENT_KEY) || '{}');
    expect(stored.necessary).toBe(true);
    expect(stored.preferences).toBe(true);
    expect(stored.analytics).toBe(false);
  });
});
