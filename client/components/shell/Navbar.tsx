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
  User,
  ChevronDown,
  LogOut,
  ShieldAlert,
  Laptop,
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

export interface UserProfile {
  id: string;
  email: string;
  inGameId?: string;
  avatarPreset?: string;
  emailVerified: boolean;
  role?: string;
}

export interface NavbarProps {
  user?: UserProfile | null;
  onLogout?: () => void;
  onOpenAuthModal?: () => void;
}

function subscribeStorage(callback: () => void) {
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
}

export function Navbar({ user, onLogout, onOpenAuthModal }: NavbarProps) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);

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

  const handleLogout = async () => {
    try {
      await fetch('/api/v1/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network errors on logout dispatch
    }
    if (onLogout) {
      onLogout();
    }
    setIsProfileDropdownOpen(false);
  };

  const avatarPreset = user?.avatarPreset || 'preset_default_01';
  const ign = user?.inGameId || user?.email?.split('@')[0] || 'Player';

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

          {/* User Profile Dropdown OR Sign In CTA */}
          {user ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                className="flex items-center gap-2 px-2.5 py-1.5 text-xs font-semibold text-text-primary bg-bg-surface-elevated hover:bg-bg-canvas rounded-lg border border-border-subtle transition-colors duration-[120ms] min-h-[40px]"
                aria-label="User Profile Menu"
                aria-expanded={isProfileDropdownOpen}
                data-testid="user-profile-button"
              >
                {/* Avatar Preset Badge */}
                <span
                  data-testid="user-avatar-badge"
                  data-preset={avatarPreset}
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-primary/20 text-emerald-primary text-[10px] font-bold border border-emerald-primary/40"
                >
                  {ign.charAt(0).toUpperCase()}
                </span>
                <span data-testid="user-ign" className="font-medium text-text-primary max-w-[120px] truncate">
                  {ign}
                </span>

                {/* Email unverified warning indicator */}
                {!user.emailVerified && (
                  <span
                    data-testid="unverified-email-dot"
                    title="Email unverified"
                    className="flex h-2 w-2 rounded-full bg-amber-400"
                  />
                )}

                <ChevronDown className="h-3.5 w-3.5 text-text-muted" />
              </button>

              {/* Profile Dropdown Menu */}
              {isProfileDropdownOpen && (
                <div
                  data-testid="user-profile-dropdown"
                  className="absolute right-0 mt-2 w-56 rounded-xl border border-border-subtle bg-bg-surface shadow-2xl p-1.5 z-50 flex flex-col gap-1 transition-transform duration-[120ms]"
                >
                  {/* Unverified Email Alert Banner */}
                  {!user.emailVerified && (
                    <div
                      data-testid="unverified-email-banner"
                      className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-medium"
                    >
                      <ShieldAlert className="h-4 w-4 shrink-0 text-amber-400" />
                      <div className="flex flex-col">
                        <span className="font-bold">Email Not Verified</span>
                        <span className="text-[10px] text-amber-300/80">Some features restricted</span>
                      </div>
                    </div>
                  )}

                  <div className="px-2 py-1.5 text-[11px] text-text-muted border-b border-border-subtle">
                    Signed in as <span className="font-semibold text-text-primary">{user.email}</span>
                  </div>

                  <Link
                    href="/profile"
                    onClick={() => setIsProfileDropdownOpen(false)}
                    className="flex items-center gap-2 px-2.5 py-2 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-bg-surface-elevated rounded-lg transition-colors duration-[120ms] min-h-[36px]"
                  >
                    <User className="h-4 w-4" />
                    <span>My Profile</span>
                  </Link>

                  <Link
                    href="/settings"
                    onClick={() => setIsProfileDropdownOpen(false)}
                    className="flex items-center gap-2 px-2.5 py-2 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-bg-surface-elevated rounded-lg transition-colors duration-[120ms] min-h-[36px]"
                  >
                    <Sliders className="h-4 w-4" />
                    <span>Settings</span>
                  </Link>

                  <Link
                    href="/settings/devices"
                    onClick={() => setIsProfileDropdownOpen(false)}
                    className="flex items-center gap-2 px-2.5 py-2 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-bg-surface-elevated rounded-lg transition-colors duration-[120ms] min-h-[36px]"
                  >
                    <Laptop className="h-4 w-4" />
                    <span>Device Management</span>
                  </Link>

                  <div className="border-t border-border-subtle my-0.5" />

                  <button
                    type="button"
                    onClick={handleLogout}
                    data-testid="logout-button"
                    className="flex items-center gap-2 w-full px-2.5 py-2 text-xs font-semibold text-red-400 hover:bg-red-950/30 rounded-lg transition-colors duration-[120ms] min-h-[36px]"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={onOpenAuthModal}
              data-testid="nav-sign-in-button"
              className="flex items-center justify-center px-4 py-2 text-sm font-semibold text-black bg-emerald-primary hover:bg-emerald-hover rounded-lg transition-transform duration-[80ms] active:scale-[0.98] shadow-sm min-h-[40px]"
            >
              Sign In
            </button>
          )}
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

        {/* User banner in drawer if logged in */}
        {user && (
          <div className="mt-4 p-3 rounded-lg bg-bg-surface-elevated border border-border-subtle flex flex-col gap-1">
            <span className="font-bold text-sm text-text-primary">{ign}</span>
            <span className="text-xs text-text-muted">{user.email}</span>
            {!user.emailVerified && (
              <span className="text-[10px] text-amber-400 font-semibold mt-1">⚠️ Email unverified</span>
            )}
          </div>
        )}

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

          {user && (
            <>
              <Link
                href="/settings/devices"
                onClick={() => setIsMobileMenuOpen(false)}
                className="px-3 py-3 text-base font-medium text-text-secondary hover:text-text-primary hover:bg-bg-surface-elevated rounded-lg transition-colors duration-[120ms] min-h-[44px] flex items-center"
              >
                Device Management
              </Link>
            </>
          )}
        </nav>

        <div className="mt-8 pt-6 border-t border-border-subtle flex flex-col gap-3">
          {user ? (
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center justify-center w-full py-3 text-center text-sm font-semibold text-red-400 bg-red-950/20 border border-red-900/30 rounded-lg min-h-[44px]"
            >
              Sign Out
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setIsMobileMenuOpen(false);
                if (onOpenAuthModal) onOpenAuthModal();
              }}
              className="flex items-center justify-center w-full py-3 text-center text-sm font-semibold text-black bg-emerald-primary rounded-lg min-h-[44px]"
            >
              Sign In
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

export default Navbar;
