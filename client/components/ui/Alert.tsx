'use client';

import React from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
} from 'lucide-react';

export type AlertVariant = 'info' | 'success' | 'warning' | 'error';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  onClose?: () => void;
  action?: React.ReactNode;
  children?: React.ReactNode;
}

const variantConfig: Record<
  AlertVariant,
  {
    containerClass: string;
    iconClass: string;
    titleClass: string;
    defaultIcon: React.ReactElement;
  }
> = {
  info: {
    containerClass:
      'border-cyan-depth/30 bg-cyan-depth/10 text-text-primary',
    iconClass: 'text-cyan-depth',
    titleClass: 'text-cyan-depth',
    defaultIcon: <Info className="h-5 w-5 shrink-0" aria-hidden="true" />,
  },
  success: {
    containerClass:
      'border-emerald-primary/30 bg-emerald-primary/10 text-text-primary',
    iconClass: 'text-emerald-primary',
    titleClass: 'text-emerald-primary',
    defaultIcon: <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />,
  },
  warning: {
    containerClass:
      'border-amber-500/30 bg-amber-500/10 text-text-primary',
    iconClass: 'text-amber-500',
    titleClass: 'text-amber-500',
    defaultIcon: <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />,
  },
  error: {
    containerClass:
      'border-rose-500/30 bg-rose-500/10 text-text-primary',
    iconClass: 'text-rose-500',
    titleClass: 'text-rose-500',
    defaultIcon: <AlertCircle className="h-5 w-5 shrink-0" aria-hidden="true" />,
  },
};

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  (
    {
      variant = 'info',
      title,
      description,
      icon,
      onClose,
      action,
      children,
      className = '',
      ...props
    },
    ref
  ) => {
    const config = variantConfig[variant];
    const isDestructive = variant === 'error';

    return (
      <div
        ref={ref}
        role={isDestructive ? 'alert' : 'status'}
        aria-live={isDestructive ? 'assertive' : 'polite'}
        className={`relative flex w-full gap-3.5 rounded-xl border p-4 shadow-sm transition-all duration-[120ms] ease-out bg-bg-surface ${config.containerClass} ${className}`}
        {...props}
      >
        {/* Leading Icon */}
        <div className={`mt-0.5 flex shrink-0 items-start ${config.iconClass}`}>
          {icon !== undefined ? icon : config.defaultIcon}
        </div>

        {/* Content Body */}
        <div className="flex-1 min-w-0 space-y-1">
          {title && (
            <h5 className={`text-sm font-bold tracking-tight ${config.titleClass}`}>
              {title}
            </h5>
          )}
          {description && (
            <div className="text-xs text-text-secondary leading-relaxed">
              {description}
            </div>
          )}
          {children && (
            <div className="text-xs text-text-secondary leading-relaxed">
              {children}
            </div>
          )}
          {action && <div className="mt-2.5 flex items-center gap-2">{action}</div>}
        </div>

        {/* Dismiss / Close Button */}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close alert"
            className="shrink-0 -mr-1 -mt-1 p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-surface-elevated transition-colors duration-[120ms] cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
    );
  }
);

Alert.displayName = 'Alert';

export default Alert;
