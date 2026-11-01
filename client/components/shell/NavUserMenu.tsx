'use client';

import React from 'react';
import Link from 'next/link';
import {
  User,
  ChevronDown,
  LogOut,
  ShieldAlert,
  ShieldCheck,
  Shield,
  Laptop,
  Sliders,
} from 'lucide-react';
import { type UserProfile } from '@smex/shared';

export interface NavUserMenuProps {
  user: UserProfile;
  isDropdownOpen: boolean;
  setIsDropdownOpen: (open: boolean) => void;
  onLogout: () => void;
}

export function NavUserMenu({
  user,
  isDropdownOpen,
  setIsDropdownOpen,
  onLogout,
}: NavUserMenuProps) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 py-1.5 text-xs font-semibold text-text-primary bg-bg-surface-elevated hover:bg-bg-canvas rounded-lg border border-border-subtle transition-colors duration-[120ms] min-h-[40px] touch-manipulation active:scale-95"
        aria-label="User Profile Menu"
        aria-expanded={isDropdownOpen}
        data-testid="user-profile-button"
      >
        <span
          data-testid="user-avatar-badge"
          data-preset={user.avatarPreset}
          className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-primary/20 text-emerald-primary text-[10px] font-bold border border-emerald-primary/40 shrink-0"
        >
          {(user.ign || user.email || '?').charAt(0).toUpperCase()}
        </span>
        <span data-testid="user-ign" className="font-medium text-text-primary max-w-[80px] sm:max-w-[120px] truncate hidden min-[420px]:inline">
          {user.ign || user.email}
        </span>

        {user.role === 'manager' && (
          <span
            data-testid="manager-badge"
            className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 uppercase"
          >
            <Shield className="h-3 w-3" />
            Mgr
          </span>
        )}

        {user.role === 'admin' && (
          <span
            data-testid="admin-badge"
            className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-primary border border-emerald-500/40 uppercase"
          >
            <ShieldCheck className="h-3 w-3" />
            Admin
          </span>
        )}

        {!user.emailVerified && (
          <span
            data-testid="unverified-email-dot"
            title="Email unverified"
            className="flex h-2 w-2 rounded-full bg-amber-400"
          />
        )}

        <ChevronDown className="h-3.5 w-3.5 text-text-muted" />
      </button>

      {isDropdownOpen && (
        <div
          data-testid="user-profile-dropdown"
          className="absolute right-0 mt-2 w-56 rounded-xl border border-border-subtle bg-bg-surface shadow-2xl p-1.5 z-50 flex flex-col gap-1 transition-transform duration-[120ms]"
        >
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

          {user.role === 'manager' && (
            <Link
              href="/manager"
              onClick={() => setIsDropdownOpen(false)}
              className="flex items-center gap-2 px-2.5 py-2 text-xs font-bold text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 rounded-lg border border-purple-500/30 transition-colors duration-[120ms] min-h-[36px]"
            >
              <Shield className="h-4 w-4 text-purple-400" />
              <span>Manager Panel</span>
            </Link>
          )}

          {user.role === 'admin' && (
            <Link
              href="/admin"
              onClick={() => setIsDropdownOpen(false)}
              className="flex items-center gap-2 px-2.5 py-2 text-xs font-bold text-emerald-primary bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg border border-emerald-500/30 transition-colors duration-[120ms] min-h-[36px]"
            >
              <ShieldCheck className="h-4 w-4" />
              <span>Admin Portal</span>
            </Link>
          )}

          <Link
            href="/profile"
            onClick={() => setIsDropdownOpen(false)}
            className="flex items-center gap-2 px-2.5 py-2 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-bg-surface-elevated rounded-lg transition-colors duration-[120ms] min-h-[36px]"
          >
            <User className="h-4 w-4" />
            <span>My Profile</span>
          </Link>

          <Link
            href="/settings"
            onClick={() => setIsDropdownOpen(false)}
            className="flex items-center gap-2 px-2.5 py-2 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-bg-surface-elevated rounded-lg transition-colors duration-[120ms] min-h-[36px]"
          >
            <Sliders className="h-4 w-4" />
            <span>Settings</span>
          </Link>

          <Link
            href="/settings/devices"
            onClick={() => setIsDropdownOpen(false)}
            className="flex items-center gap-2 px-2.5 py-2 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-bg-surface-elevated rounded-lg transition-colors duration-[120ms] min-h-[36px]"
          >
            <Laptop className="h-4 w-4" />
            <span>Device Management</span>
          </Link>

          <div className="border-t border-border-subtle my-0.5" />

          <button
            type="button"
            onClick={onLogout}
            data-testid="logout-button"
            className="flex items-center gap-2 w-full px-2.5 py-2 text-xs font-semibold text-red-400 hover:bg-red-950/30 rounded-lg transition-colors duration-[120ms] min-h-[36px]"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </button>
        </div>
      )}
    </div>
  );
}
