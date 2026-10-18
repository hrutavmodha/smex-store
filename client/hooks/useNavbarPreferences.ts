'use client';

import { useEffect, useSyncExternalStore } from 'react';

export type ThemeMode = 'dark' | 'amoled' | 'light';
export type DensityMode = 'compact' | 'comfortable' | 'spacious';

function subscribeStorage(callback: () => void) {
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
}

export function useNavbarPreferences() {
  const theme = useSyncExternalStore<ThemeMode>(
    subscribeStorage,
    () => {
      if (typeof window === 'undefined' || !window.localStorage) return 'dark';
      const stored = window.localStorage.getItem('smex_theme') as ThemeMode;
      return stored || 'dark';
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
      if (savedTheme && (savedTheme === 'dark' || savedTheme === 'amoled' || savedTheme === 'light')) {
        document.documentElement.setAttribute('data-theme', savedTheme);
      }
      const savedDensity = window.localStorage?.getItem('smex_density') as DensityMode;
      if (savedDensity && (savedDensity === 'compact' || savedDensity === 'comfortable' || savedDensity === 'spacious')) {
        document.documentElement.setAttribute('data-density', savedDensity);
      }
    }
  }, []);

  const handleCycleTheme = () => {
    const cycleMap: Record<ThemeMode, ThemeMode> = {
      dark: 'amoled',
      amoled: 'light',
      light: 'dark',
    };
    const nextTheme = cycleMap[theme];
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('smex_theme', nextTheme);
    }
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', nextTheme);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('storage'));
    }
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
    }
  };

  return {
    theme,
    density,
    handleCycleTheme,
    handleCycleDensity,
  };
}
