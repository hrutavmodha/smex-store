'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
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
import { fetchWithAuth } from '../../lib/api';
import { NotificationCenter } from '../notifications/NotificationCenter';
import { UniversalSearchModal } from '../search/UniversalSearchModal';
import { useNavbarPreferences, type ThemeMode, type DensityMode } from '../../hooks/useNavbarPreferences';
import { NavUserMenu } from './NavUserMenu';
import { NavMobileDrawer } from './NavMobileDrawer';
import { type UserProfile } from '@smex/shared';

export const NAV_LINKS = [
  { href: '/tournaments', label: 'Tournaments' },
  { href: '/teams', label: 'Teams & Groups' },
  { href: '/marketplace', label: 'ID Marketplace' },
  { href: '/boosting', label: 'Rank Boosting' },
  { href: '/leaderboard', label: 'Leaderboards' },
  { href: '/about', label: 'About Us' },
] as const;

export type { ThemeMode, DensityMode };

export interface NavbarProps {
  user?: UserProfile | null;
  onLogout?: () => void;
  onOpenAuthModal?: (view?: 'login' | 'register') => void;
}

export function Navbar({ user, onLogout, onOpenAuthModal }: NavbarProps) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const { theme, density, handleCycleTheme, handleCycleDensity } = useNavbarPreferences();

  useEffect(() => {
    function handleGlobalKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    }
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const handleLogout = async () => {
    try {
      await fetchWithAuth('/api/v1/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network errors on logout dispatch
    }
    if (onLogout) {
      onLogout();
    }
    setIsProfileDropdownOpen(false);
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
            <Image
              src="/logo.png"
              alt="Smex Store Logo"
              width={32}
              height={32}
              className="h-8 w-8 rounded-lg object-contain"
              priority
            />
            <span className="font-heading font-bold text-lg tracking-tight text-text-primary">
              Smex Store
            </span>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1" aria-label="Main Navigation">
            {NAV_LINKS.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors duration-[120ms] min-h-[36px] flex items-center ${
                    isActive
                      ? 'bg-bg-surface-elevated text-emerald-primary'
                      : 'text-text-secondary hover:text-text-primary hover:bg-bg-surface-elevated'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right Utility Actions */}
        <div className="hidden sm:flex items-center gap-2.5">
          {/* Universal Search (Cmd+K) Trigger */}
          <button
            type="button"
            onClick={() => setIsSearchOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-text-secondary bg-bg-canvas border border-border-subtle rounded-lg hover:border-border-prominent hover:text-text-primary transition-colors duration-[120ms] min-h-[36px]"
            aria-label="Search (Cmd+K)"
          >
            <Search className="h-3.5 w-3.5 text-text-muted" />
            <span className="hidden md:inline">Search...</span>
            <kbd className="hidden md:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-bg-surface-elevated text-text-muted rounded border border-border-subtle">
              ⌘K
            </kbd>
          </button>

          {/* Real-time Notification Center */}
          <NotificationCenter user={user} />

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
            <NavUserMenu
              user={user}
              isDropdownOpen={isProfileDropdownOpen}
              setIsDropdownOpen={setIsProfileDropdownOpen}
              onLogout={handleLogout}
            />
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenAuthModal?.('login')}
                data-testid="nav-sign-in-button"
                className="flex items-center justify-center px-3.5 py-2 text-sm font-semibold text-text-primary hover:text-emerald-primary transition-colors duration-[120ms] min-h-[40px]"
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => onOpenAuthModal?.('register')}
                data-testid="nav-sign-up-button"
                className="flex items-center justify-center px-4 py-2 text-sm font-semibold text-black bg-emerald-primary hover:bg-emerald-hover rounded-lg transition-transform duration-[80ms] active:scale-[0.98] shadow-sm min-h-[40px]"
              >
                Sign Up
              </button>
            </div>
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

      {/* Mobile Slide-Out Drawer */}
      <NavMobileDrawer
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        user={user}
        navLinks={NAV_LINKS}
        onLogout={handleLogout}
        onOpenAuthModal={onOpenAuthModal}
      />

      {/* Universal Search Modal */}
      <UniversalSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </header>
  );
}

export default Navbar;
