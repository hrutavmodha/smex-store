'use client';

import React, { useState } from 'react';
import { Navbar, type UserProfile } from './Navbar';
import { Footer } from './Footer';
import { AuthModal, type AuthView } from '../auth/AuthModal';

export interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authView, setAuthView] = useState<AuthView>('login');
  const [user, setUser] = useState<UserProfile | null>(null);

  const handleOpenAuth = (view: 'login' | 'register' = 'login') => {
    setAuthView(view);
    setIsAuthModalOpen(true);
  };

  const handleLogout = () => {
    setUser(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('smex_auth_token');
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar
        user={user}
        onLogout={handleLogout}
        onOpenAuthModal={(view) => handleOpenAuth(view || 'login')}
      />
      <main className="flex-1">
        {children}
      </main>
      <Footer />
      <AuthModal
        key={`${isAuthModalOpen}-${authView}`}
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialView={authView}
      />
    </div>
  );
}

export default AppShell;
