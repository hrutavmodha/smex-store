'use client';

import React, { useState } from 'react';
import { Eye, EyeOff, Loader2, CheckCircle2 } from 'lucide-react';
import { Alert } from '../ui/Alert';

export interface RegisterFormProps {
  onSuccess?: () => void;
  onSwitchToLogin?: () => void;
}

export function RegisterForm({ onSuccess, onSwitchToLogin }: RegisterFormProps) {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    username?: string;
    password?: string;
    confirmPassword?: string;
  }>({});
  const [isLoading, setIsLoading] = useState(false);

  const validate = () => {
    const errors: {
      email?: string;
      username?: string;
      password?: string;
      confirmPassword?: string;
    } = {};

    if (!email.trim()) {
      errors.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Please enter a valid email address';
    }

    if (!username.trim()) {
      errors.username = 'In-Game Name (IGN) is required';
    } else if (username.trim().length < 3 || username.trim().length > 32) {
      errors.username = 'In-Game Name must be between 3 and 32 characters';
    } else if (!/^[a-zA-Z0-9_]+$/.test(username.trim())) {
      errors.username = 'In-Game Name must only contain alphanumeric characters and underscores';
    }

    if (!password) {
      errors.password = 'Password is required';
    } else {
      if (password.length < 8) {
        errors.password = 'Password must be at least 8 characters long';
      } else if (!/[A-Z]/.test(password)) {
        errors.password = 'Password must contain at least one uppercase letter';
      } else if (!/[a-z]/.test(password)) {
        errors.password = 'Password must contain at least one lowercase letter';
      } else if (!/[0-9]/.test(password)) {
        errors.password = 'Password must contain at least one number';
      } else if (!/[^A-Za-z0-9]/.test(password)) {
        errors.password = 'Password must contain at least one special character';
      }
    }

    if (password && confirmPassword !== password) {
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
      const response = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
          username: username.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || errorData.message || 'Registration failed');
      }

      setIsSuccess(true);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="flex flex-col items-center text-center gap-4 py-4 w-full">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-primary/10 text-emerald-primary">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <div className="flex flex-col gap-1">
          <h3 className="text-base font-bold text-text-primary">Account Created!</h3>
          <p className="text-xs text-text-secondary max-w-xs">
            Your account has been created successfully. You can now continue to sign in.
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
            Continue to Sign In
          </button>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 w-full" noValidate>
      {errorMessage && (
        <Alert variant="error" description={errorMessage} />
      )}

      {/* Email Input */}
      <div className="flex flex-col gap-1">
        <label htmlFor="reg-email" className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
          Email Address
        </label>
        <input
          id="reg-email"
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
          aria-describedby={fieldErrors.email ? 'reg-email-error' : undefined}
        />
        {fieldErrors.email && (
          <span id="reg-email-error" className="text-xs text-red-400 font-medium">
            {fieldErrors.email}
          </span>
        )}
      </div>

      {/* In-Game Name (IGN) Input */}
      <div className="flex flex-col gap-1">
        <label htmlFor="reg-username" className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
          In-Game Name (IGN)
        </label>
        <input
          id="reg-username"
          type="text"
          value={username}
          onChange={(e) => {
            setUsername(e.target.value);
            if (fieldErrors.username) setFieldErrors((prev) => ({ ...prev, username: undefined }));
          }}
          placeholder="e.g. ApexPredator"
          autoComplete="username"
          className={`h-11 w-full px-3 text-sm text-text-primary bg-bg-canvas border rounded-lg outline-none transition-colors duration-[120ms] ${
            fieldErrors.username ? 'border-red-500 focus:border-red-400' : 'border-border-subtle focus:border-emerald-primary'
          }`}
          aria-invalid={!!fieldErrors.username}
          aria-describedby={fieldErrors.username ? 'reg-username-error' : undefined}
        />
        {fieldErrors.username && (
          <span id="reg-username-error" className="text-xs text-red-400 font-medium">
            {fieldErrors.username}
          </span>
        )}
      </div>

      {/* Password with Show/Hide Toggle */}
      <div className="flex flex-col gap-1">
        <label htmlFor="reg-password" className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
          Password
        </label>
        <div className="relative flex items-center">
          <input
            id="reg-password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
            }}
            placeholder="Min. 8 chars (1 upper, 1 lower, 1 num, 1 sym)"
            autoComplete="new-password"
            className={`h-11 w-full pl-3 pr-12 text-sm text-text-primary bg-bg-canvas border rounded-lg outline-none transition-colors duration-[120ms] ${
              fieldErrors.password ? 'border-red-500 focus:border-red-400' : 'border-border-subtle focus:border-emerald-primary'
            }`}
            aria-invalid={!!fieldErrors.password}
            aria-describedby={fieldErrors.password ? 'reg-password-error' : undefined}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-0 flex items-center justify-center min-h-[44px] min-w-[44px] text-text-secondary hover:text-text-primary transition-colors duration-[120ms]"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            data-testid="toggle-register-password-visibility"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {fieldErrors.password && (
          <span id="reg-password-error" className="text-xs text-red-400 font-medium">
            {fieldErrors.password}
          </span>
        )}
      </div>

      {/* Confirm Password */}
      <div className="flex flex-col gap-1">
        <label htmlFor="reg-confirm-password" className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
          Confirm Password
        </label>
        <input
          id="reg-confirm-password"
          type={showPassword ? 'text' : 'password'}
          value={confirmPassword}
          onChange={(e) => {
            setConfirmPassword(e.target.value);
            if (fieldErrors.confirmPassword) setFieldErrors((prev) => ({ ...prev, confirmPassword: undefined }));
          }}
          placeholder="Repeat password"
          autoComplete="new-password"
          className={`h-11 w-full px-3 text-sm text-text-primary bg-bg-canvas border rounded-lg outline-none transition-colors duration-[120ms] ${
            fieldErrors.confirmPassword ? 'border-red-500 focus:border-red-400' : 'border-border-subtle focus:border-emerald-primary'
          }`}
          aria-invalid={!!fieldErrors.confirmPassword}
          aria-describedby={fieldErrors.confirmPassword ? 'reg-confirm-password-error' : undefined}
        />
        {fieldErrors.confirmPassword && (
          <span id="reg-confirm-password-error" className="text-xs text-red-400 font-medium">
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
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          'Create Account'
        )}
      </button>

      {/* Switch to Login */}
      {onSwitchToLogin && (
        <div className="mt-2 text-center text-xs text-text-secondary">
          Already have an account?{' '}
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="font-semibold text-emerald-primary hover:underline transition-colors duration-[120ms] min-h-[44px] inline-flex items-center"
          >
            Sign in
          </button>
        </div>
      )}
    </form>
  );
}

export default RegisterForm;
