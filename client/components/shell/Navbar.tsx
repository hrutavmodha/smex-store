'use client';

import React, { useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Search,
  Moon,
  Sun,
  Smartphone,
  Sliders,
  Menu,
  X,
} from 'lucide-react';

export const NAV_LINKS = [
  { href: '/tournaments', label: 'Tournaments' },
  { href: '/teams', label: 'Teams & Groups' },
  { href: '/marketplace', label: 'ID Marketplace' },
  { href: '/boosting', label: 'Rank Boosting' },
  { href: '/leaderboard', label: 'Leaderboards' },
  { href: '/about', label: 'About Us' },
] as const;

export type ThemeMode = 'dark' | 'amoled' | 'light';
export type DensityMode = 'compact' | 'comfortable' | 'spacious';

function subscribeStorage(callback: () => void) {
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
}

export function Navbar() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const theme = useSyncExternalStore<ThemeMode>(
    subscribeStorage,
    () => {
      if (typeof window === 'undefined') return 'dark';
      const stored = localStorage.getItem('smex_theme') as ThemeMode;
      return stored || 'dark';
    },
    () => 'dark'
  );

  const density = useSyncExternalStore<DensityMode>(
    subscribeStorage,
    () => {
      if (typeof window === 'undefined') return 'comfortable';
      const stored = localStorage.getItem('smex_density') as DensityMode;
      return stored || 'comfortable';
    },
    () => 'comfortable'
  );

  const handleCycleTheme = () => {
    const cycleMap: Record<ThemeMode, ThemeMode> = {
      dark: 'amoled',
      amoled: 'light',
      light: 'dark',
    };
    const nextTheme = cycleMap[theme];
    localStorage.setItem('smex_theme', nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
    window.dispatchEvent(new Event('storage'));
  };

  const handleCycleDensity = () => {
    const cycleMap: Record<DensityMode, DensityMode> = {
      comfortable: 'compact',
      compact: 'spacious',
      spacious: 'comfortable',
    };
    const nextDensity = cycleMap[density];
    localStorage.setItem('smex_density', nextDensity);
    document.documentElement.setAttribute('data-density', nextDensity);
    window.dispatchEvent(new Event('storage'));
  };

  return (
    <header className="sticky top-0 z-50 h-16 w-full border-b border-border-subtle bg-bg-surface transition-colors duration-[120ms]">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Emblem & Logo */}
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="flex items-center gap-2.5 text-text-primary no-underline transition-transform duration-[120ms] active:scale-[0.98]"
            aria-label="Smex Store Home"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-primary text-black font-black text-lg shadow-sm">
              S
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold tracking-wider text-base uppercase leading-none text-text-primary">
                Smex Store
              </span>
              <span className="text-[10px] tracking-widest uppercase font-semibold text-emerald-primary">
                Esports Hub
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1" aria-label="Main Navigation">
            {NAV_LINKS.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-2 text-sm font-medium rounded-md transition-colors duration-[120ms] ${
                    isActive
                      ? 'bg-bg-surface-elevated text-emerald-primary font-semibold'
                      : 'text-text-secondary hover:text-text-primary hover:bg-bg-surface-elevated'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Action Controls & Interactive Cluster */}
        <div className="hidden sm:flex items-center gap-2.5">
          {/* Universal Search Shortcut */}
          <button
            type="button"
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-text-secondary bg-bg-canvas border border-border-subtle rounded-lg hover:border-border-prominent hover:text-text-primary transition-colors duration-[120ms] min-h-[36px]"
            aria-label="Search (Cmd+K)"
          >
            <Search className="h-3.5 w-3.5 text-text-muted" />
            <span className="hidden md:inline">Search...</span>
            <kbd className="hidden md:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-bg-surface-elevated text-text-muted rounded border border-border-subtle">
              ⌘K
            </kbd>
          </button>

          {/* Theme Toggle (Dark -> AMOLED -> Light) */}
          <button
            type="button"
            onClick={handleCycleTheme}
            className="flex items-center justify-center p-2 text-text-secondary hover:text-text-primary bg-bg-surface hover:bg-bg-surface-elevated rounded-lg border border-border-subtle transition-colors duration-[120ms] min-w-[40px] min-h-[40px]"
            aria-label={`Toggle theme (current: ${theme})`}
            data-testid="theme-toggle"
          >
            {theme === 'dark' && <Moon className="h-4 w-4" />}
            {theme === 'amoled' && <Smartphone className="h-4 w-4 text-emerald-primary" />}
            {theme === 'light' && <Sun className="h-4 w-4 text-cyan-depth" />}
          </button>

          {/* Density Toggle (Comfortable -> Compact -> Spacious) */}
          <button
            type="button"
            onClick={handleCycleDensity}
            className="flex items-center justify-center p-2 text-text-secondary hover:text-text-primary bg-bg-surface hover:bg-bg-surface-elevated rounded-lg border border-border-subtle transition-colors duration-[120ms] min-w-[40px] min-h-[40px]"
            aria-label={`Toggle density (current: ${density})`}
            data-testid="density-toggle"
          >
            <Sliders className="h-4 w-4" />
          </button>

          {/* Login / Register Primary CTA */}
          <Link
            href="/login"
            className="flex items-center justify-center px-4 py-2 text-sm font-semibold text-black bg-emerald-primary hover:bg-emerald-hover rounded-lg transition-transform duration-[80ms] active:scale-[0.98] shadow-sm min-h-[40px]"
          >
            Sign In
          </Link>
        </div>

        {/* Mobile Hamburger & Controls Trigger */}
        <div className="flex items-center gap-2 sm:hidden">
          <button
            type="button"
            onClick={handleCycleTheme}
            className="flex items-center justify-center p-2.5 text-text-secondary hover:text-text-primary bg-bg-surface-elevated rounded-lg min-w-[44px] min-h-[44px]"
            aria-label={`Toggle theme (current: ${theme})`}
            data-testid="mobile-theme-toggle"
          >
            {theme === 'dark' && <Moon className="h-5 w-5" />}
            {theme === 'amoled' && <Smartphone className="h-5 w-5 text-emerald-primary" />}
            {theme === 'light' && <Sun className="h-5 w-5 text-cyan-depth" />}
          </button>

          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="flex items-center justify-center p-2.5 text-text-secondary hover:text-text-primary bg-bg-surface-elevated rounded-lg min-w-[44px] min-h-[44px]"
            aria-label={isMobileMenuOpen ? 'Close Navigation Menu' : 'Open Navigation Menu'}
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Slide-Out Drawer (Hardware Transform over 120ms, NO opacity fade, NO backdrop-filter blur) */}
      <div
        className={`fixed inset-y-0 right-0 z-50 w-72 bg-bg-surface border-l border-border-subtle p-6 transition-transform duration-[120ms] ease-out sm:hidden ${
          isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-hidden={!isMobileMenuOpen}
      >
        <div className="flex items-center justify-between pb-6 border-b border-border-subtle">
          <span className="font-bold text-sm tracking-wide uppercase text-text-primary">Menu</span>
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(false)}
            className="p-2 text-text-secondary hover:text-text-primary min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Close Drawer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="mt-6 flex flex-col gap-2" aria-label="Mobile Navigation">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setIsMobileMenuOpen(false)}
              className="px-3 py-3 text-base font-medium text-text-secondary hover:text-text-primary hover:bg-bg-surface-elevated rounded-lg transition-colors duration-[120ms] min-h-[44px] flex items-center"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="mt-8 pt-6 border-t border-border-subtle flex flex-col gap-3">
          <Link
            href="/login"
            onClick={() => setIsMobileMenuOpen(false)}
            className="flex items-center justify-center w-full py-3 text-center text-sm font-semibold text-black bg-emerald-primary rounded-lg min-h-[44px]"
          >
            Sign In
          </Link>
        </div>
      </div>
    </header>
  );
}

export default Navbar;
