'use client';

import { useEffect, useSyncExternalStore } from 'react';

export type ThemeMode = 'dark' | 'light' | 'amoled';
export type DensityMode = 'compact' | 'comfortable' | 'spacious';

const preferenceListeners = new Set<() => void>();

function notifyPreferenceListeners() {
  preferenceListeners.forEach((callback) => {
    try {
      callback();
    } catch {
      // ignore callback error
    }
  });
}

function subscribeStorage(callback: () => void) {
  preferenceListeners.add(callback);
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', callback);
    window.addEventListener('smex:preferences-change', callback);
  }
  return () => {
    preferenceListeners.delete(callback);
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', callback);
      window.removeEventListener('smex:preferences-change', callback);
    }
  };
}

export function useNavbarPreferences() {
  const theme = useSyncExternalStore<ThemeMode>(
    subscribeStorage,
    () => {
      if (typeof window === 'undefined' || !window.localStorage) return 'dark';
      const stored = window.localStorage.getItem('smex_theme') as ThemeMode;
      return stored === 'light' ? 'light' : stored === 'amoled' ? 'amoled' : 'dark';
    },
    () => 'dark'
  );

  const density = useSyncExternalStore<DensityMode>(
    subscribeStorage,
    () => {
      if (typeof window === 'undefined' || !window.localStorage) return 'comfortable';
      const stored = window.localStorage.getItem('smex_density') as DensityMode;
      return stored || 'comfortable';
    },
    () => 'comfortable'
  );

  // Hydrate stored theme and density preferences into <html> on mount
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const savedTheme = window.localStorage?.getItem('smex_theme') as ThemeMode;
      if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'amoled') {
        document.documentElement.setAttribute('data-theme', savedTheme);
      }
      const savedDensity = window.localStorage?.getItem('smex_density') as DensityMode;
      if (savedDensity && (savedDensity === 'compact' || savedDensity === 'comfortable' || savedDensity === 'spacious')) {
        document.documentElement.setAttribute('data-density', savedDensity);
      }
    }
  }, []);

  const handleCycleTheme = () => {
    const nextTheme: ThemeMode = theme === 'dark' ? 'light' : 'dark';
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('smex_theme', nextTheme);
    }
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', nextTheme);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('smex:preferences-change', { detail: { theme: nextTheme } }));
    }
    notifyPreferenceListeners();
  };

  const handleCycleDensity = () => {
    const cycleMap: Record<DensityMode, DensityMode> = {
      comfortable: 'compact',
      compact: 'spacious',
      spacious: 'comfortable',
    };
    const nextDensity = cycleMap[density];
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('smex_density', nextDensity);
    }
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-density', nextDensity);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('smex:preferences-change', { detail: { density: nextDensity } }));
    }
    notifyPreferenceListeners();
  };

  return {
    theme,
    density,
    handleCycleTheme,
    handleCycleDensity,
  };
}

