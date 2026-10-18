'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { Navbar } from './Navbar';
import { type UserProfile } from '@smex/shared';
import { Footer } from './Footer';
import { CookieConsentBanner } from './CookieConsentBanner';
import { AuthModal, type AuthView } from '../auth/AuthModal';
import { fetchWithAuth } from '../../lib/api';

export interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authView, setAuthView] = useState<AuthView>('login');
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    let isMounted = true;
    const bootstrapSession = async () => {
      try {
        const response = await fetchWithAuth('/api/v1/auth/me');
        if (!isMounted) return;
        if (response.ok) {
          const data = await response.json();
          setUser({
            uid: data.id || data.uid,
            email: data.email,
            ign: data.ign || data.profile?.username || data.username || '',
            avatarPreset: data.avatarPreset || data.profile?.avatarPreset || 'preset_default_01',
            emailVerified: Boolean(data.emailVerified),
            role: data.role,
          });
        } else if (response.status === 401) {
          setUser(null);
        }
      } catch {
        // Silently handle network errors
      }
    };

    void bootstrapSession();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleOpenAuth = (view: 'login' | 'register' = 'login') => {
    setAuthView(view);
    setIsAuthModalOpen(true);
  };

  const handleLogout = () => {
    void fetchWithAuth('/api/v1/auth/logout', { method: 'POST' }).catch(() => {});
    setUser(null);
  };

  const handleAuthSuccess = (loggedInUser?: UserProfile) => {
    if (loggedInUser) {
      setUser(loggedInUser);
    }

    void fetchWithAuth('/api/v1/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setUser({
            uid: data.id || data.uid,
            email: data.email,
            ign: data.ign || data.profile?.username || data.username || '',
            avatarPreset: data.avatarPreset || data.profile?.avatarPreset || 'preset_default_01',
            emailVerified: Boolean(data.emailVerified),
            role: data.role,
          });
        }
      })
      .catch(() => {});
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Suspense fallback={<div className="h-16 w-full bg-bg-surface" />}>
        <Navbar
          user={user}
          onLogout={handleLogout}
          onOpenAuthModal={(view) => handleOpenAuth(view || 'login')}
        />
      </Suspense>
      <main className="flex-1">
        {children}
      </main>
      <Footer />
      <AuthModal
        key={`${isAuthModalOpen}-${authView}`}
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialView={authView}
        onSuccess={handleAuthSuccess}
      />
      <CookieConsentBanner />
    </div>
  );
}

export default AppShell;
