'use client';

import React, { useState, useEffect } from 'react';
import { Cookie, ShieldCheck, ChevronDown, Check } from 'lucide-react';
import {
  COOKIE_CONSENT_KEY,
  type CookieConsentPreferences,
} from '@smex/shared';

export function CookieConsentBanner() {
  const [isVisible, setIsVisible] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [preferences, setPreferences] = useState({
    preferences: true,
    analytics: true,
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const stored = localStorage.getItem(COOKIE_CONSENT_KEY);
        if (!stored) {
          setIsVisible(true);
        }
      } catch {
        setIsVisible(true);
      }
    }, 50);

    return () => clearTimeout(timer);
  }, []);

  const saveConsent = (prefs: { preferences: boolean; analytics: boolean }) => {
    const consentPayload: CookieConsentPreferences = {
      necessary: true,
      preferences: prefs.preferences,
      analytics: prefs.analytics,
      consentedAt: new Date().toISOString(),
      version: '1.0.0',
    };

    try {
      localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(consentPayload));
      document.cookie = `${COOKIE_CONSENT_KEY}=${encodeURIComponent(
        JSON.stringify(consentPayload)
      )}; path=/; max-age=31536000; SameSite=Lax`;
    } catch {
      // Ignore storage errors
    }

    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <aside
      role="region"
      aria-label="Cookie Consent"
      data-testid="cookie-consent-banner"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 rounded-2xl border border-border-subtle bg-bg-surface p-5 shadow-2xl transition-all duration-200 ease-out"
      style={{ backdropFilter: 'none' }}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-primary/10 border border-emerald-primary/30 text-emerald-primary">
          <Cookie className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            Cookie Preferences
          </h3>
          <p className="mt-1 text-xs text-text-muted leading-relaxed">
            We use strictly necessary cookies to keep you signed in securely, alongside optional cookies for theme settings and analytics.
          </p>
        </div>
      </div>

      {showPreferences && (
        <div className="mt-4 space-y-3 rounded-xl border border-border-subtle/50 bg-bg-surface-elevated p-3 text-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-text-primary">Strictly Necessary</p>
              <p className="text-[11px] text-text-muted">Auth session tokens and security</p>
            </div>
            <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-primary">
              <ShieldCheck className="h-3.5 w-3.5" /> Required
            </span>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border-subtle/40">
            <div>
              <p className="font-medium text-text-primary">Functional Preferences</p>
              <p className="text-[11px] text-text-muted">Theme and display density modes</p>
            </div>
            <input
              type="checkbox"
              checked={preferences.preferences}
              onChange={(e) =>
                setPreferences((prev) => ({ ...prev, preferences: e.target.checked }))
              }
              data-testid="cookie-pref-functional"
              className="accent-emerald-primary h-4 w-4 rounded cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border-subtle/40">
            <div>
              <p className="font-medium text-text-primary">Performance & Analytics</p>
              <p className="text-[11px] text-text-muted">Anonymous performance telemetry</p>
            </div>
            <input
              type="checkbox"
              checked={preferences.analytics}
              onChange={(e) =>
                setPreferences((prev) => ({ ...prev, analytics: e.target.checked }))
              }
              data-testid="cookie-pref-analytics"
              className="accent-emerald-primary h-4 w-4 rounded cursor-pointer"
            />
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => saveConsent({ preferences: true, analytics: true })}
          data-testid="cookie-accept-all"
          className="flex-1 rounded-lg bg-emerald-primary px-3 py-2 text-xs font-semibold text-black transition-colors hover:bg-emerald-primary/90"
        >
          Accept All
        </button>

        <button
          type="button"
          onClick={() => saveConsent({ preferences: false, analytics: false })}
          data-testid="cookie-reject-all"
          className="flex-1 rounded-lg bg-bg-surface-elevated border border-border-subtle px-3 py-2 text-xs font-semibold text-text-secondary transition-colors hover:text-text-primary hover:bg-bg-canvas"
        >
          Reject Non-Essential
        </button>

        <button
          type="button"
          onClick={() => {
            if (showPreferences) {
              saveConsent(preferences);
            } else {
              setShowPreferences(true);
            }
          }}
          data-testid="cookie-customize"
          className="w-full flex items-center justify-center gap-1 rounded-lg border border-border-subtle/60 py-1.5 text-[11px] font-medium text-text-muted hover:text-text-primary hover:bg-bg-surface-elevated"
        >
          {showPreferences ? (
            <>
              <Check className="h-3 w-3 text-emerald-primary" /> Save Preferences
            </>
          ) : (
            <>
              <span>Customize</span>
              <ChevronDown className="h-3 w-3" />
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
