'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';
import { ForgotPasswordForm } from './ForgotPasswordForm';
import type { UserProfile } from '../shell/Navbar';

export type AuthView = 'login' | 'register' | 'forgot-password';

export interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialView?: AuthView;
  onSuccess?: (user?: UserProfile) => void;
}

export function AuthModal({
  isOpen,
  onClose,
  initialView = 'login',
  onSuccess,
}: AuthModalProps) {
  const [view, setView] = useState<AuthView>(initialView);

  if (!isOpen) return null;

  const handleSuccess = (user?: UserProfile) => {
    if (onSuccess) {
      onSuccess(user);
    }
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Solid Backdrop: Pure dark overlay with ZERO backdrop-filter blur and ZERO opacity fade */}
      <div
        className="fixed inset-0 bg-black/85"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Surface:
          Dark Mode: Solid Obsidian #12181D.
          AMOLED Mode: Pure True-Black #000000 with subtle border #1F1F1F.
          Physical transitions: 120ms transform, zero opacity fades, zero backdrop-filter blur.
      */}
      <div
        data-testid="auth-modal-surface"
        className="relative z-10 w-full max-w-md rounded-2xl border border-border-subtle bg-[#12181D] [data-theme=amoled]_&:bg-[#000000] [data-theme=amoled]_&:border-[#1F1F1F] p-6 shadow-2xl transition-transform duration-[120ms] ease-out"
      >
        {/* Header Cluster */}
        <div className="flex items-center justify-between pb-4 border-b border-border-subtle">
          <div className="flex flex-col">
            <h2 id="auth-modal-title" className="text-lg font-extrabold uppercase tracking-wide text-text-primary">
              {view === 'login' && 'Sign In'}
              {view === 'register' && 'Create Account'}
              {view === 'forgot-password' && 'Reset Password'}
            </h2>
            <span className="text-xs text-text-secondary">
              {view === 'login' && 'Access your Smex Store esports profile'}
              {view === 'register' && 'Join tournaments, squads, and ID marketplace'}
              {view === 'forgot-password' && 'Enter your email to receive recovery instructions'}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center p-2 text-text-secondary hover:text-text-primary rounded-lg transition-colors duration-[120ms] min-h-[44px] min-w-[44px]"
            aria-label="Close authentication modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Views */}
        <div className="mt-5">
          {view === 'login' && (
            <LoginForm
              onSuccess={handleSuccess}
              onSwitchToRegister={() => setView('register')}
              onSwitchToForgotPassword={() => setView('forgot-password')}
            />
          )}

          {view === 'register' && (
            <RegisterForm
              onSuccess={handleSuccess}
              onSwitchToLogin={() => setView('login')}
            />
          )}

          {view === 'forgot-password' && (
            <ForgotPasswordForm
              onSuccess={handleSuccess}
              onSwitchToLogin={() => setView('login')}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default AuthModal;
