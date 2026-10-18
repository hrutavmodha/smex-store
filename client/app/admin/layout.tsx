'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ShieldAlert, ShieldCheck, Home, DollarSign, Activity } from 'lucide-react';
import { useAuth } from '../../lib/useAuth';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, isAuthenticated, isAdmin } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login?redirect=/admin');
    }
  }, [loading, isAuthenticated, router]);

  if (loading) {
    return (
      <div
        data-testid="admin-loading"
        className="min-h-screen bg-[#000000] text-emerald-400 flex items-center justify-center p-6 font-mono"
        style={{ backgroundColor: '#000000' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span>Authenticating Administrator...</span>
        </div>
      </div>
    );
  }

  // Unauthenticated user redirect state
  if (!isAuthenticated) {
    return (
      <div
        data-testid="admin-redirecting"
        className="min-h-screen bg-[#000000] text-gray-400 flex items-center justify-center font-mono"
        style={{ backgroundColor: '#000000' }}
      >
        Redirecting to login...
      </div>
    );
  }

  // Non-admin user 403 Access Denied screen
  if (!isAdmin) {
    return (
      <main
        data-testid="admin-access-denied"
        className="min-h-screen bg-[#000000] flex flex-col items-center justify-center p-6 text-white font-sans transition-all duration-120 ease-out"
        style={{ backgroundColor: '#000000' }}
      >
        <div
          className="max-w-md w-full bg-[#121C19] border border-[#223530] rounded-xl p-8 text-center transition-all duration-120 ease-out shadow-2xl"
          style={{ backgroundColor: '#121C19', borderColor: '#223530' }}
        >
          <div className="w-14 h-14 bg-red-950/60 border border-red-500/40 rounded-full flex items-center justify-center mx-auto mb-5 text-[#EF4444]">
            <ShieldAlert size={28} />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white mb-2">403 Forbidden</h1>
          <p className="text-sm text-gray-300 font-medium mb-6">
            Access Denied: Administrative Credentials Required
          </p>
          <p className="text-xs text-gray-400 mb-8 leading-relaxed">
            Your account ({user?.email}) does not have administrative privileges. All administrative
            actions and moderation facilities are strictly monitored.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 w-full px-5 py-3 rounded-lg bg-[#1FAE7A] hover:bg-[#22C58F] text-black font-bold text-sm tracking-wide transition-all duration-120 ease-out min-h-[44px]"
          >
            <Home size={16} />
            <span>Return to Home</span>
          </Link>
        </div>
      </main>
    );
  }

  const navItems = [
    { href: '/admin', label: 'Overview', icon: Activity },
    { href: '/admin/rates', label: 'Boosting Rates', icon: DollarSign },
  ];

  return (
    <div
      data-testid="admin-portal-root"
      className="min-h-screen bg-[#000000] text-gray-100 flex flex-col font-sans transition-all duration-120 ease-out"
      style={{ backgroundColor: '#000000' }}
    >
      {/* Top Admin Header */}
      <header
        className="bg-[#0B0F12] border-b border-[#223530] px-6 py-3.5 flex items-center justify-between transition-all duration-120 ease-out sticky top-0 z-50"
        style={{ borderColor: '#223530' }}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-[#121C19] border border-[#223530]">
            <ShieldCheck size={16} className="text-[#22C58F]" />
            <span className="text-xs font-mono font-bold tracking-wider text-[#22C58F] uppercase">
              Admin Portal
            </span>
          </div>
          <span className="text-xs text-gray-400 font-mono hidden sm:inline">Smex Store Governance</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-xs font-mono text-gray-300">
            Admin: <span className="text-white font-semibold">{user?.ign || user?.email}</span>
          </div>
          <Link
            href="/"
            className="text-xs text-gray-400 hover:text-white transition-all duration-120 ease-out flex items-center gap-1.5"
          >
            <Home size={14} />
            <span>Exit to Site</span>
          </Link>
        </div>
      </header>

      {/* Admin Navigation Bar */}
      <nav
        className="bg-[#0B0F12]/90 border-b border-[#223530] px-6 py-2 flex items-center gap-2 overflow-x-auto"
        style={{ borderColor: '#223530' }}
      >
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold tracking-wide transition-all duration-120 ease-out min-h-[36px] ${
                isActive
                  ? 'bg-[#121C19] text-[#22C58F] border border-[#223530]'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#121C19]/50'
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
