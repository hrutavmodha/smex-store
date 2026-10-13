'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { MailCheck, CheckCircle2, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams?.get('token') || null;

  const [status, setStatus] = useState<'verifying' | 'success' | 'error' | 'no-token'>('verifying');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus('no-token');
      return;
    }

    let isMounted = true;
    const verifyToken = async () => {
      try {
        const response = await fetch('/api/v1/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.detail || errorData.message || 'Verification token is invalid or has expired'
          );
        }

        if (isMounted) {
          setStatus('success');
          // Automatically redirect to home after email verification
          setTimeout(() => {
            router.push('/?auth=login');
          }, 1500);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setStatus('error');
          setErrorMessage(
            err instanceof Error
              ? err.message
              : 'Failed to verify email. The link may have expired or already been used.'
          );
        }
      }
    };

    void verifyToken();
    return () => {
      isMounted = false;
    };
  }, [token, router]);

  if (status === 'no-token') {
    return (
      <div className="flex flex-col items-center text-center gap-4 py-6 w-full" data-testid="missing-token-card">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-950/40 border border-red-800/60 text-red-400">
          <AlertCircle className="h-6 w-6" />
        </div>
        <div className="flex flex-col gap-1.5">
          <h2 className="text-lg font-extrabold uppercase tracking-wide text-text-primary">
            Missing Verification Token
          </h2>
          <p className="text-xs text-text-secondary max-w-sm">
            No verification token was detected in your link. Please check the URL provided in your email.
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

  if (status === 'verifying') {
    return (
      <div className="flex flex-col items-center text-center gap-4 py-8 w-full" data-testid="verifying-state">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-primary" />
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-bold text-text-primary">Verifying Email Address</h2>
          <p className="text-xs text-text-secondary">
            Please wait while we validate your token with Smex Store security servers...
          </p>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="flex flex-col items-center text-center gap-4 py-6 w-full" data-testid="verify-success-card">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-primary/10 text-emerald-primary border border-emerald-primary/30">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <div className="flex flex-col gap-1.5">
          <h2 className="text-lg font-extrabold uppercase tracking-wide text-text-primary">
            Email Verified Successfully
          </h2>
          <p className="text-xs text-text-secondary max-w-sm">
            Your account is now verified! You can now participate in tournaments, create ID listings, and join squads. Redirecting...
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push('/?auth=login')}
          data-testid="continue-to-login-button"
          className="mt-2 min-h-[44px] px-6 text-sm font-semibold text-black bg-emerald-primary hover:bg-emerald-hover rounded-lg transition-transform duration-[80ms] active:scale-[0.98]"
        >
          Continue to Sign In
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center text-center gap-4 py-6 w-full" data-testid="verify-error-card">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-950/40 border border-red-800/60 text-red-400">
        <AlertCircle className="h-6 w-6" />
      </div>
      <div className="flex flex-col gap-1.5">
        <h2 className="text-lg font-extrabold uppercase tracking-wide text-text-primary">
          Verification Failed
        </h2>
        <p className="text-xs text-red-400 max-w-sm">
          {errorMessage || 'This verification link is invalid or has expired.'}
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

export default function VerifyEmailPage() {
  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-border-subtle bg-bg-surface [data-theme=amoled]_&:bg-[#000000] [data-theme=amoled]_&:border-[#1F1F1F] p-6 sm:p-8 shadow-2xl transition-colors duration-[120ms]">
        <div className="flex items-center gap-2.5 pb-4 mb-4 border-b border-border-subtle">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-primary/10 text-emerald-primary border border-emerald-primary/20">
            <MailCheck className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold uppercase text-xs tracking-wider text-text-primary">
              Account Security
            </span>
            <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-primary">
              Email Verification
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
          <VerifyEmailContent />
        </Suspense>
      </div>
    </div>
  );
}
