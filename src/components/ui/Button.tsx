'use client';

import React from 'react';

// ============================================
// Button Component — Premium, Accessible
// ============================================

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  fullWidth?: boolean;
  children: React.ReactNode;
}

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  disabled,
  children,
  className = '',
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <>
      <button
        className={`btn btn--${variant} btn--${size} ${fullWidth ? 'btn--full' : ''} ${className}`}
        disabled={isDisabled}
        aria-busy={loading}
        {...props}
      >
        {loading && (
          <span className="btn__spinner" aria-hidden="true" />
        )}
        <span className={loading ? 'btn__content--loading' : ''}>
          {children}
        </span>
      </button>

      <style jsx>{`
        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: var(--space-2);
          border: none;
          border-radius: var(--radius-md);
          font-family: var(--font-family);
          font-weight: var(--font-weight-semibold);
          line-height: 1;
          cursor: pointer;
          transition: all var(--transition-base);
          position: relative;
          overflow: hidden;
          white-space: nowrap;
          min-height: var(--min-touch-target);
          user-select: none;
          -webkit-user-select: none;
        }

        .btn:active:not(:disabled) {
          transform: scale(0.97);
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Sizes */
        .btn--sm {
          padding: var(--space-2) var(--space-4);
          font-size: var(--font-size-sm);
          min-height: 40px;
        }

        .btn--md {
          padding: var(--space-3) var(--space-6);
          font-size: var(--font-size-base);
          min-height: var(--min-touch-target);
        }

        .btn--lg {
          padding: var(--space-4) var(--space-8);
          font-size: var(--font-size-lg);
          min-height: 56px;
        }

        /* Variants */
        .btn--primary {
          background: linear-gradient(135deg, var(--color-primary), var(--color-primary-light));
          color: white;
          box-shadow: var(--shadow-md), 0 0 0 0 var(--color-primary-glow);
        }

        .btn--primary:hover:not(:disabled) {
          box-shadow: var(--shadow-lg), var(--shadow-glow);
          filter: brightness(1.1);
        }

        .btn--secondary {
          background: var(--color-surface);
          color: var(--color-text);
          border: 1px solid var(--color-border);
        }

        .btn--secondary:hover:not(:disabled) {
          background: var(--color-surface-light);
          border-color: var(--color-border-light);
        }

        .btn--ghost {
          background: transparent;
          color: var(--color-text-secondary);
        }

        .btn--ghost:hover:not(:disabled) {
          background: var(--color-surface);
          color: var(--color-text);
        }

        .btn--danger {
          background: var(--color-error);
          color: white;
        }

        .btn--danger:hover:not(:disabled) {
          filter: brightness(1.1);
          box-shadow: var(--shadow-lg);
        }

        /* Full width */
        .btn--full {
          width: 100%;
        }

        /* Spinner */
        .btn__spinner {
          width: 18px;
          height: 18px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }

        .btn__content--loading {
          opacity: 0.7;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </>
  );
}
