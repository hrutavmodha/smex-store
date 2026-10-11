'use client';

import React, { useState } from 'react';
import { Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';

export interface LoginFormProps {
  onSuccess?: () => void;
  onSwitchToRegister?: () => void;
  onSwitchToForgotPassword?: () => void;
}

export function LoginForm({
  onSuccess,
  onSwitchToRegister,
  onSwitchToForgotPassword,
}: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [isLoading, setIsLoading] = useState(false);

  const validate = () => {
    const errors: { email?: string; password?: string } = {};
    if (!email.trim()) {
      errors.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Please enter a valid email address';
    }

    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters long';
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
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || errorData.message || 'Invalid email or password');
      }

      if (onSuccess) {
        onSuccess();
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Authentication failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

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

      {/* Email Input */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="login-email" className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
          Email Address
        </label>
        <input
          id="login-email"
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
          aria-describedby={fieldErrors.email ? 'login-email-error' : undefined}
        />
        {fieldErrors.email && (
          <span id="login-email-error" className="text-xs text-red-400 font-medium">
            {fieldErrors.email}
          </span>
        )}
      </div>

      {/* Password Input with Show/Hide Toggle */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="login-password" className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
            Password
          </label>
          {onSwitchToForgotPassword && (
            <button
              type="button"
              onClick={onSwitchToForgotPassword}
              className="text-xs font-medium text-emerald-primary hover:underline transition-colors duration-[120ms] min-h-[32px] flex items-center"
            >
              Forgot password?
            </button>
          )}
        </div>
        <div className="relative flex items-center">
          <input
            id="login-password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
            }}
            placeholder="••••••••"
            autoComplete="current-password"
            className={`h-11 w-full pl-3 pr-12 text-sm text-text-primary bg-bg-canvas border rounded-lg outline-none transition-colors duration-[120ms] ${
              fieldErrors.password ? 'border-red-500 focus:border-red-400' : 'border-border-subtle focus:border-emerald-primary'
            }`}
            aria-invalid={!!fieldErrors.password}
            aria-describedby={fieldErrors.password ? 'login-password-error' : undefined}
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
        {fieldErrors.password && (
          <span id="login-password-error" className="text-xs text-red-400 font-medium">
            {fieldErrors.password}
          </span>
        )}
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isLoading}
        className="mt-2 flex items-center justify-center min-h-[44px] w-full font-bold text-sm text-black bg-emerald-primary hover:bg-emerald-hover rounded-lg transition-transform duration-[80ms] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
      >
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          'Sign In'
        )}
      </button>

      {/* Switch to Register */}
      {onSwitchToRegister && (
        <div className="mt-2 text-center text-xs text-text-secondary">
          Don&apos;t have an account?{' '}
          <button
            type="button"
            onClick={onSwitchToRegister}
            className="font-semibold text-emerald-primary hover:underline transition-colors duration-[120ms] min-h-[44px] inline-flex items-center"
          >
            Create an account
          </button>
        </div>
      )}
    </form>
  );
}

export default LoginForm;
