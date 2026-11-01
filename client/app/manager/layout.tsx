'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Shield,
  ShieldAlert,
  Home,
  Activity,
  Trophy,
  Zap,
} from 'lucide-react';
import { useAuth } from '../../lib/useAuth';

export default function ManagerLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, isAuthenticated, isStaff } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login?redirect=/manager');
    }
  }, [loading, isAuthenticated, router]);

  if (loading) {
    return (
      <div
        data-testid="manager-loading"
        className="min-h-screen bg-bg-canvas text-purple-400 flex items-center justify-center p-6 font-mono"
      >
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
          <span>Authenticating Standing Manager...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div
        data-testid="manager-redirecting"
        className="min-h-screen bg-bg-canvas text-text-secondary flex items-center justify-center font-mono"
      >
        Redirecting to login...
      </div>
    );
  }

  // Non-manager/non-admin user 403 Access Denied screen
  if (!isStaff) {
    return (
      <main
        data-testid="manager-access-denied"
        className="min-h-screen bg-bg-canvas flex flex-col items-center justify-center p-6 text-text-primary font-sans transition-all duration-120 ease-out"
      >
        <div className="max-w-md w-full bg-bg-surface border border-border-subtle rounded-xl p-8 text-center transition-all duration-120 ease-out shadow-2xl">
          <div className="w-14 h-14 bg-red-950/60 border border-red-500/40 rounded-full flex items-center justify-center mx-auto mb-5 text-[#EF4444]">
            <ShieldAlert size={28} />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-text-primary mb-2">403 Forbidden</h1>
          <p className="text-sm text-text-secondary font-medium mb-6">
            Access Denied: Standing Manager Privileges Required
          </p>
          <p className="text-xs text-text-muted mb-8 leading-relaxed">
            Your account ({user?.email}) does not hold Manager operations authority.
            Match adjudication and order fulfillment actions are strictly monitored.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 w-full px-5 py-3 rounded-lg bg-emerald-primary hover:bg-[#22C58F] text-[#0B1A15] font-bold text-sm tracking-wide transition-all duration-120 ease-out min-h-[44px]"
          >
            <Home size={16} />
            <span>Return to Home</span>
          </Link>
        </div>
      </main>
    );
  }

  const navItems = [
    { href: '/manager', label: 'Operations Overview', icon: Activity },
    { href: '/tournaments', label: 'Tournaments & Matches', icon: Trophy },
    { href: '/boosting', label: 'Boosting Operations', icon: Zap },
  ];

  return (
    <div
      data-testid="manager-portal-root"
      className="min-h-screen bg-bg-canvas text-text-primary flex flex-col font-sans transition-all duration-120 ease-out"
    >
      {/* Top Manager Header */}
      <header className="bg-bg-surface border-b border-border-subtle px-6 py-3.5 flex items-center justify-between transition-all duration-120 ease-out sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-bg-surface-elevated border border-purple-500/30">
            <Shield size={16} className="text-purple-400" />
            <span className="text-xs font-mono font-bold tracking-wider text-purple-300 uppercase">
              Manager Panel
            </span>
          </div>
          <span className="text-xs text-text-muted font-mono hidden sm:inline">
            Tournament & Order Operations
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-xs font-mono text-text-secondary">
            Manager: <span className="text-text-primary font-semibold">{user?.ign || user?.email}</span>
          </div>
          <Link
            href="/"
            className="text-xs text-text-secondary hover:text-text-primary transition-all duration-120 ease-out flex items-center gap-1.5"
          >
            <Home size={14} />
            <span>Exit to Site</span>
          </Link>
        </div>
      </header>

      {/* Manager Navigation Bar */}
      <nav className="bg-bg-surface border-b border-border-subtle px-6 py-2 flex items-center gap-2 overflow-x-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold tracking-wide transition-all duration-120 ease-out min-h-[36px] ${
                isActive
                  ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-surface-elevated'
              }`}
            >
              <Icon size={14} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto transition-all duration-120 ease-out">
        {children}
      </main>
    </div>
  );
}
