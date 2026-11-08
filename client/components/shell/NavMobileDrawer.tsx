'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  X,
  ShieldCheck,
  Shield,
  Sliders,
  LogOut,
} from 'lucide-react';
import { type UserProfile } from '@smex/shared';
import type { DensityMode } from '../../hooks/useNavbarPreferences';

export interface NavLinkItem {
  readonly href: string;
  readonly label: string;
}

export interface NavMobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  user?: UserProfile | null;
  navLinks: readonly NavLinkItem[];
  onLogout: () => void;
  onOpenAuthModal?: (view?: 'login' | 'register') => void;
  density?: DensityMode;
  onCycleDensity?: () => void;
}

export function NavMobileDrawer({
  isOpen,
  onClose,
  user,
  navLinks,
  onLogout,
  onOpenAuthModal,
  density,
  onCycleDensity,
}: NavMobileDrawerProps) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [isRendered, setIsRendered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsRendered(true);
      const rAF = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsVisible(true);
        });
      });
      return () => cancelAnimationFrame(rAF);
    } else {
      setIsVisible(false);
      const timer = setTimeout(() => {
        setIsRendered(false);
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Lock body scroll when drawer is open on mobile
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isRendered || !mounted || typeof document === 'undefined' || !document.body) {
    return null;
  }

  const content = (
    <div className={`sm:hidden fixed inset-0 z-50 ${isVisible ? 'pointer-events-auto' : 'pointer-events-none'}`}>
      {/* Full-Screen Backdrop Overlay */}
      <div
        className={`fixed inset-0 bg-black/60 z-40 transition-opacity duration-[250ms] ease-out ${
          isVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
        data-testid="mobile-drawer-backdrop"
      />

      {/* Slide-Out Drawer Panel */}
      <div
        className={`fixed inset-y-0 right-0 z-50 w-72 bg-bg-surface border-l border-border-subtle p-6 transition-transform duration-[250ms] ease-out flex flex-col will-change-transform ${
          isVisible ? 'translate-x-0 pointer-events-auto' : 'translate-x-full pointer-events-none'
        }`}
        aria-hidden={!isVisible}
      >
        <div className="flex items-center justify-between pb-5 border-b border-border-subtle shrink-0">
          <span className="font-bold text-sm tracking-wide uppercase text-text-primary">Navigation</span>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-text-secondary hover:text-text-primary min-w-[40px] min-h-[40px] flex items-center justify-center touch-manipulation active:scale-95 transition-transform"
            aria-label="Close Drawer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* User banner in drawer if logged in */}
        {user && (
          <div className="mt-4 p-3.5 rounded-xl bg-bg-surface-elevated border border-border-subtle flex flex-col gap-2 shrink-0">
            <div className="flex items-center gap-2.5">
              <span
                data-preset={user.avatarPreset}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-primary/20 text-emerald-primary text-xs font-bold border border-emerald-primary/40 shrink-0"
              >
                {(user.ign || user.email || '?').charAt(0).toUpperCase()}
              </span>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm text-text-primary truncate">
                    {user.ign || user.email}
                  </span>
                  {user.role === 'manager' && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 uppercase">
                      <Shield className="h-2.5 w-2.5" />
                      Mgr
                    </span>
                  )}
                  {user.role === 'admin' && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-primary border border-emerald-500/40 uppercase">
                      <ShieldCheck className="h-2.5 w-2.5" />
                      Admin
                    </span>
                  )}
                </div>
                {user.inGameId && (
                  <span className="text-[10px] font-mono text-text-secondary truncate">
                    ID: {user.inGameId}
                  </span>
                )}
              </div>
            </div>

            {!user.emailVerified && (
              <div className="flex items-center gap-1.5 p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-medium">
                <span>⚠️ Email not verified</span>
              </div>
            )}
          </div>
        )}

        {/* Scrollable Navigation Area */}
        <nav className="mt-4 flex flex-col gap-1 overflow-y-auto flex-1 pr-1" aria-label="Mobile Navigation">
          <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-text-muted px-3 py-1">
            Menu
          </div>
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={onClose}
                className={`px-3 py-2.5 text-sm font-semibold rounded-lg transition-colors duration-[120ms] min-h-[40px] flex items-center ${
                  isActive
                    ? 'bg-bg-surface-elevated text-emerald-primary'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-surface-elevated'
                }`}
              >
                {link.label}
              </Link>
            );
          })}

          {/* Density Preference Switcher in Drawer */}
          {onCycleDensity && (
            <div className="pt-2">
              <button
                type="button"
                onClick={onCycleDensity}
                className="w-full px-3 py-2.5 text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-bg-surface-elevated rounded-lg transition-colors duration-[120ms] min-h-[40px] flex items-center justify-between"
              >
                <span className="flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-emerald-primary" />
                  <span>Display Density</span>
                </span>
                <span className="capitalize text-[11px] font-mono px-2 py-0.5 rounded bg-bg-surface-elevated text-text-primary border border-border-subtle">
                  {density || 'comfortable'}
                </span>
              </button>
            </div>
          )}
        </nav>

        {/* Footer Actions */}
        <div className="mt-auto pt-4 border-t border-border-subtle flex flex-col gap-2 shrink-0">
          {user ? (
            <button
              type="button"
              onClick={onLogout}
              className="flex items-center justify-center gap-2 w-full py-2.5 text-center text-xs font-semibold text-red-400 bg-red-950/20 hover:bg-red-950/40 border border-red-900/30 rounded-lg min-h-[44px] transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAuthModal?.('login');
                }}
                data-testid="mobile-sign-in-button"
                className="flex items-center justify-center w-full py-2.5 text-center text-xs font-semibold text-text-primary hover:text-emerald-primary bg-bg-surface-elevated rounded-lg min-h-[44px] transition-colors"
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAuthModal?.('register');
                }}
                data-testid="mobile-sign-up-button"
                className="flex items-center justify-center w-full py-2.5 text-center text-xs font-bold text-black bg-emerald-primary hover:bg-emerald-hover rounded-lg min-h-[44px] transition-transform active:scale-[0.98]"
              >
                Sign Up
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
