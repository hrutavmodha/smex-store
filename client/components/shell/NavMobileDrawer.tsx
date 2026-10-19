'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { X } from 'lucide-react';
import { type UserProfile } from '@smex/shared';

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
}

export function NavMobileDrawer({
  isOpen,
  onClose,
  user,
  navLinks,
  onLogout,
  onOpenAuthModal,
}: NavMobileDrawerProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  const content = (
    <div className="sm:hidden">
      {/* Full-Screen Backdrop Overlay */}
      <div
        className={`fixed inset-0 bg-black/60 z-40 transition-opacity duration-[120ms] ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
        data-testid="mobile-drawer-backdrop"
      />

      {/* Slide-Out Drawer Panel */}
      <div
        className={`fixed inset-y-0 right-0 z-50 w-72 bg-bg-surface border-l border-border-subtle p-6 transition-transform duration-[120ms] ease-out flex flex-col ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-hidden={!isOpen}
      >
        <div className="flex items-center justify-between pb-6 border-b border-border-subtle shrink-0">
          <span className="font-bold text-sm tracking-wide uppercase text-text-primary">Menu</span>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-text-secondary hover:text-text-primary min-w-[44px] min-h-[44px] flex items-center justify-center touch-manipulation active:scale-95 transition-transform"
            aria-label="Close Drawer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>


      {/* User banner in drawer if logged in */}
      {user && (
        <div className="mt-4 p-3 rounded-lg bg-bg-surface-elevated border border-border-subtle flex flex-col gap-1">
          <span className="font-bold text-sm text-text-primary">{user.ign || user.email}</span>
          <span className="text-xs text-text-muted">{user.email}</span>
          <span data-testid="mobile-user-uid" className="font-mono text-[10px] text-text-muted">
            UID: {user.uid}
          </span>
          {!user.emailVerified && (
            <span className="text-[10px] text-amber-400 font-semibold mt-1">⚠️ Email unverified</span>
          )}
        </div>
      )}

      <nav className="mt-6 flex flex-col gap-2" aria-label="Mobile Navigation">
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            onClick={onClose}
            className="px-3 py-3 text-base font-medium text-text-secondary hover:text-text-primary hover:bg-bg-surface-elevated rounded-lg transition-colors duration-[120ms] min-h-[44px] flex items-center"
          >
            {link.label}
          </Link>
        ))}

        {user && (
          <Link
            href="/settings/devices"
            onClick={onClose}
            className="px-3 py-3 text-base font-medium text-text-secondary hover:text-text-primary hover:bg-bg-surface-elevated rounded-lg transition-colors duration-[120ms] min-h-[44px] flex items-center"
          >
            Device Management
          </Link>
        )}
      </nav>

      <div className="mt-8 pt-6 border-t border-border-subtle flex flex-col gap-3">
        {user ? (
          <button
            type="button"
            onClick={onLogout}
            className="flex items-center justify-center w-full py-3 text-center text-sm font-semibold text-red-400 bg-red-950/20 border border-red-900/30 rounded-lg min-h-[44px]"
          >
            Sign Out
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
              className="flex items-center justify-center w-full py-2.5 text-center text-sm font-semibold text-text-primary bg-bg-surface-elevated rounded-lg min-h-[44px]"
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
              className="flex items-center justify-center w-full py-2.5 text-center text-sm font-semibold text-black bg-emerald-primary rounded-lg min-h-[44px]"
            >
              Sign Up
            </button>
          </div>
        )}
      </div>
    </div>
  </div>
  );

  if (!mounted || typeof document === 'undefined' || !document.body) {
    return null;
  }

  return createPortal(content, document.body);
}

