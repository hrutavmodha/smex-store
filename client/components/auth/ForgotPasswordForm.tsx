'use client';

import React, { useState } from 'react';
import { CheckCircle2, Loader2, ArrowLeft } from 'lucide-react';
import { Alert } from '../ui/Alert';

export interface ForgotPasswordFormProps {
  onSuccess?: () => void;
  onSwitchToLogin?: () => void;
}

export function ForgotPasswordForm({ onSuccess, onSwitchToLogin }: ForgotPasswordFormProps) {
  const [email, setEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string }>({});
  const [isLoading, setIsLoading] = useState(false);

  const validate = () => {
    const errors: { email?: string } = {};
    if (!email.trim()) {
      errors.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Please enter a valid email address';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!validate()) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/v1/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || errorData.message || 'Password reset request failed');
      }

      setIsSubmitted(true);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Password recovery failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="flex flex-col items-center text-center gap-4 py-4 w-full">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-primary/10 text-emerald-primary">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <div className="flex flex-col gap-1">
          <h3 className="text-base font-bold text-text-primary">Reset Link Dispatched</h3>
          <p className="text-xs text-text-secondary max-w-xs">
            If an account is associated with <span className="font-semibold text-text-primary">{email}</span>, you will receive password reset instructions shortly.
          </p>
        </div>
        {onSwitchToLogin && (
          <button
            type="button"
            onClick={() => {
              if (onSuccess) onSuccess();
              onSwitchToLogin();
            }}
            className="mt-2 min-h-[44px] px-6 text-sm font-semibold text-black bg-emerald-primary hover:bg-emerald-hover rounded-lg transition-transform duration-[80ms] active:scale-[0.98]"
          >
            Back to Sign In
          </button>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full" noValidate>
      {errorMessage && (
        <Alert variant="error" description={errorMessage} />
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="forgot-email" className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
          Account Email
        </label>
        <input
          id="forgot-email"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
          }}
          placeholder="player@example.com"
          autoComplete="email"
          className={`h-11 w-full px-3 text-sm text-text-primary bg-bg-canvas border rounded-lg outline-none transition-colors duration-[120ms] ${
            fieldErrors.email ? 'border-red-500 focus:border-red-400' : 'border-border-subtle focus:border-emerald-primary'
          }`}
          aria-invalid={!!fieldErrors.email}
          aria-describedby={fieldErrors.email ? 'forgot-email-error' : undefined}
        />
        {fieldErrors.email && (
          <span id="forgot-email-error" className="text-xs text-red-400 font-medium">
            {fieldErrors.email}
          </span>
        )}
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="mt-2 flex items-center justify-center min-h-[44px] w-full font-bold text-sm text-black bg-emerald-primary hover:bg-emerald-hover rounded-lg transition-transform duration-[80ms] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
      >
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          'Send Recovery Link'
        )}
      </button>

      {onSwitchToLogin && (
        <div className="mt-2 text-center text-xs text-text-secondary">
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="inline-flex items-center gap-1.5 font-semibold text-text-secondary hover:text-text-primary transition-colors duration-[120ms] min-h-[44px]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Sign In
          </button>
        </div>
      )}
    </form>
  );
}

export default ForgotPasswordForm;
