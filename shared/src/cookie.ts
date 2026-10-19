export type CookieConsentCategory = 'necessary' | 'preferences' | 'analytics';

export interface CookieConsentPreferences {
  necessary: true; // Always true, strictly necessary for authentication and security
  preferences: boolean; // Functional cookies: theme, UI density
  analytics: boolean; // Performance telemetry and usage analytics
  consentedAt: string; // ISO 8601 timestamp
  version: string; // Policy schema version
}

export const COOKIE_CONSENT_KEY = 'smex_cookie_consent';
export const AUTH_COOKIE_NAME = 'smex_access_token';
export const REFRESH_COOKIE_NAME = '__Host-refresh-token';
export const DEV_REFRESH_COOKIE_NAME = 'smex_refresh_token';
export const THEME_STORAGE_KEY = 'smex_theme';
export const DENSITY_STORAGE_KEY = 'smex_density';

export const DEFAULT_COOKIE_PREFERENCES: CookieConsentPreferences = {
  necessary: true,
  preferences: true,
  analytics: true,
  consentedAt: new Date(0).toISOString(),
  version: '1.0.0',
};
