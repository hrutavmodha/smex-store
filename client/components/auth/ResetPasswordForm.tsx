'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

export interface ResetPasswordFormProps {
  token: string;
  onSuccess?: () => void;
  onGoToLogin?: () => void;
}

export function ResetPasswordForm({ token, onSuccess, onGoToLogin }: ResetPasswordFormProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    newPassword?: string;
    confirmPassword?: string;
  }>({});

  const validate = () => {
    const errors: {
      newPassword?: string;
      confirmPassword?: string;
    } = {};

    if (!newPassword) {
      errors.newPassword = 'New password is required';
    } else if (newPassword.length < 8) {
      errors.newPassword = 'Password must be at least 8 characters long';
    } else if (newPassword.length > 128) {
      errors.newPassword = 'Password must not exceed 128 characters';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
      errors.newPassword = 'Password must contain uppercase, lowercase, and numeric characters';
    }

    if (!confirmPassword) {
      errors.confirmPassword = 'Confirm your new password';
    } else if (confirmPassword !== newPassword) {
      errors.confirmPassword = 'Passwords do not match';
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
      const response = await fetch('/api/v1/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          newPassword,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || errorData.message || 'Password reset failed');
      }

      setIsSuccess(true);
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Password reset failed. The link may have expired.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="flex flex-col items-center text-center gap-4 py-4 w-full" data-testid="reset-success-screen">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-primary/10 text-emerald-primary">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <div className="flex flex-col gap-1">
          <h3 className="text-base font-bold text-text-primary">Password Reset Successfully</h3>
          <p className="text-xs text-text-secondary max-w-xs">
            Your password has been securely updated. You can now sign in with your new credentials.
          </p>
        </div>
        {onGoToLogin ? (
          <button
            type="button"
            onClick={onGoToLogin}
            data-testid="continue-to-login-button"
            className="mt-2 min-h-[44px] px-6 text-sm font-semibold text-black bg-emerald-primary hover:bg-emerald-hover rounded-lg transition-transform duration-[80ms] active:scale-[0.98]"
          >
            Continue to Sign In
          </button>
        ) : (
          <Link
            href="/?auth=login"
            data-testid="continue-to-login-link"
            className="mt-2 min-h-[44px] px-6 flex items-center justify-center text-sm font-semibold text-black bg-emerald-primary hover:bg-emerald-hover rounded-lg transition-transform duration-[80ms] active:scale-[0.98]"
          >
            Continue to Sign In
          </Link>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full" noValidate>
      {errorMessage && (
        <div
          role="alert"
          className="flex items-center gap-2 p-3 text-sm text-red-400 bg-red-950/40 border border-red-800/60 rounded-lg"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* New Password */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="reset-new-password"
          className="text-xs font-semibold uppercase tracking-wider text-text-secondary"
        >
          New Password
        </label>
        <div className="relative flex items-center">
          <input
            id="reset-new-password"
            type={showPassword ? 'text' : 'password'}
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value);
              if (fieldErrors.newPassword) {
                setFieldErrors((prev) => ({ ...prev, newPassword: undefined }));
              }
            }}
            placeholder="••••••••"
            autoComplete="new-password"
            className={`h-11 w-full pl-3 pr-12 text-sm text-text-primary bg-bg-canvas border rounded-lg outline-none transition-colors duration-[120ms] ${
              fieldErrors.newPassword
                ? 'border-red-500 focus:border-red-400'
                : 'border-border-subtle focus:border-emerald-primary'
            }`}
            aria-invalid={!!fieldErrors.newPassword}
            aria-describedby={fieldErrors.newPassword ? 'reset-new-password-error' : undefined}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-0 flex items-center justify-center min-h-[44px] min-w-[44px] text-text-secondary hover:text-text-primary transition-colors duration-[120ms]"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            data-testid="toggle-password-visibility"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {fieldErrors.newPassword && (
          <span id="reset-new-password-error" className="text-xs text-red-400 font-medium">
            {fieldErrors.newPassword}
          </span>
        )}
      </div>

      {/* Confirm Password */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="reset-confirm-password"
          className="text-xs font-semibold uppercase tracking-wider text-text-secondary"
        >
          Confirm New Password
        </label>
        <div className="relative flex items-center">
          <input
            id="reset-confirm-password"
            type={showConfirmPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              if (fieldErrors.confirmPassword) {
                setFieldErrors((prev) => ({ ...prev, confirmPassword: undefined }));
              }
            }}
            placeholder="••••••••"
            autoComplete="new-password"
            className={`h-11 w-full pl-3 pr-12 text-sm text-text-primary bg-bg-canvas border rounded-lg outline-none transition-colors duration-[120ms] ${
              fieldErrors.confirmPassword
                ? 'border-red-500 focus:border-red-400'
                : 'border-border-subtle focus:border-emerald-primary'
            }`}
            aria-invalid={!!fieldErrors.confirmPassword}
            aria-describedby={fieldErrors.confirmPassword ? 'reset-confirm-password-error' : undefined}
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-0 flex items-center justify-center min-h-[44px] min-w-[44px] text-text-secondary hover:text-text-primary transition-colors duration-[120ms]"
            aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
            data-testid="toggle-confirm-password-visibility"
          >
            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {fieldErrors.confirmPassword && (
          <span id="reset-confirm-password-error" className="text-xs text-red-400 font-medium">
            {fieldErrors.confirmPassword}
          </span>
        )}
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isLoading}
        className="mt-2 flex items-center justify-center min-h-[44px] w-full font-bold text-sm text-black bg-emerald-primary hover:bg-emerald-hover rounded-lg transition-transform duration-[80ms] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
      >
        {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Update Password'}
      </button>
    </form>
  );
}

export default ResetPasswordForm;
