'use client';

import React, { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Lock, AlertCircle, ArrowLeft, Loader2 } from 'lucide-react';
import { ResetPasswordForm } from '../../components/auth/ResetPasswordForm';

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams?.get('token') || null;

  const handleSuccess = () => {
    // Automatically redirect to home after password reset
    setTimeout(() => {
      router.push('/?auth=login');
    }, 1500);
  };

  const handleGoToLogin = () => {
    router.push('/?auth=login');
  };

  if (!token) {
    return (
      <div className="flex flex-col items-center text-center gap-4 py-6 w-full" data-testid="missing-token-card">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-950/40 border border-red-800/60 text-red-400">
          <AlertCircle className="h-6 w-6" />
        </div>
        <div className="flex flex-col gap-1.5">
          <h2 className="text-lg font-extrabold uppercase tracking-wide text-text-primary">
            Invalid Reset Link
          </h2>
          <p className="text-xs text-text-secondary max-w-sm">
            No password reset token was found in the link. Please request a new recovery link or sign in to your account.
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push('/')}
          className="mt-2 inline-flex items-center gap-2 px-6 py-2.5 text-xs font-semibold text-text-primary bg-bg-surface-elevated hover:bg-bg-canvas rounded-lg border border-border-subtle transition-colors duration-[120ms] min-h-[44px]"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Return to Home</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex flex-col gap-1 border-b border-border-subtle pb-4">
        <h1 className="text-lg font-black uppercase tracking-wide text-text-primary">
          Choose a New Password
        </h1>
        <p className="text-xs text-text-secondary">
          Enter and confirm your new password below to regain access to your Smex Store account.
        </p>
      </div>
      <ResetPasswordForm
        token={token}
        onSuccess={handleSuccess}
        onGoToLogin={handleGoToLogin}
      />
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-border-subtle bg-bg-surface p-6 sm:p-8 shadow-2xl transition-colors duration-[120ms]">
        <div className="flex items-center gap-2.5 pb-4 mb-4 border-b border-border-subtle">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-primary/10 text-emerald-primary border border-emerald-primary/20">
            <Lock className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold uppercase text-xs tracking-wider text-text-primary">
              Security & Credentials
            </span>
            <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-primary">
              Password Reset
            </span>
          </div>
        </div>

        <Suspense
          fallback={
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-primary" />
            </div>
          }
        >
          <ResetPasswordContent />
        </Suspense>
      </div>
    </div>
  );
}
