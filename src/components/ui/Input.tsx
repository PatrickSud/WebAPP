'use client';

import React, { useId, useCallback } from 'react';

// ============================================
// Input Component — Accessible, with Phone Mask
// ============================================

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: string;
  error?: string;
  hint?: string;
  mask?: 'phone';
  icon?: React.ReactNode;
  size?: 'md' | 'lg';
}

/**
 * Apply Brazilian phone mask: (XX) XXXXX-XXXX
 */
function applyPhoneMask(value: string): string {
  // Strip everything except digits
  const digits = value.replace(/\D/g, '').slice(0, 11);

  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

/**
 * Strip the mask, returning raw digits.
 */
export function unmaskPhone(value: string): string {
  return value.replace(/\D/g, '');
}

export default function Input({
  label,
  error,
  hint,
  mask,
  icon,
  size = 'md',
  className = '',
  onChange,
  value,
  ...props
}: InputProps) {
  const generatedId = useId();
  const inputId = props.id || generatedId;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (mask === 'phone') {
        const masked = applyPhoneMask(e.target.value);
        // Create a synthetic event with the masked value
        const syntheticEvent = {
          ...e,
          target: { ...e.target, value: masked },
        } as React.ChangeEvent<HTMLInputElement>;
        onChange?.(syntheticEvent);
      } else {
        onChange?.(e);
      }
    },
    [mask, onChange]
  );

  return (
    <>
      <div className={`input-group input-group--${size} ${error ? 'input-group--error' : ''} ${className}`}>
        <label htmlFor={inputId} className="input-group__label">
          {label}
        </label>

        <div className="input-group__wrapper">
          {icon && (
            <span className="input-group__icon" aria-hidden="true">
              {icon}
            </span>
          )}
          <input
            id={inputId}
            className="input-group__input"
            aria-invalid={!!error}
            aria-describedby={
              [error ? errorId : '', hint ? hintId : ''].filter(Boolean).join(' ') || undefined
            }
            onChange={handleChange}
            value={value}
            inputMode={mask === 'phone' ? 'tel' : undefined}
            maxLength={mask === 'phone' ? 15 : undefined}
            {...props}
          />
        </div>

        {hint && !error && (
          <p id={hintId} className="input-group__hint">
            {hint}
          </p>
        )}

        {error && (
          <p id={errorId} className="input-group__error" role="alert">
            {error}
          </p>
        )}
      </div>

      <style jsx>{`
        .input-group {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
          width: 100%;
        }

        .input-group__label {
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-medium);
          color: var(--color-text-secondary);
          cursor: pointer;
        }

        .input-group__wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .input-group__icon {
          position: absolute;
          left: var(--space-4);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-text-muted);
          pointer-events: none;
          z-index: 1;
        }

        .input-group__input {
          width: 100%;
          background: var(--color-bg);
          border: 1.5px solid var(--color-border);
          border-radius: var(--radius-md);
          color: var(--color-text);
          font-size: var(--font-size-base);
          transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
        }

        /* Size: md */
        .input-group--md .input-group__input {
          padding: var(--space-3) var(--space-4);
          min-height: var(--min-touch-target);
        }

        .input-group--md .input-group__icon + .input-group__input {
          padding-left: calc(var(--space-4) + 24px + var(--space-2));
        }

        /* Size: lg */
        .input-group--lg .input-group__input {
          padding: var(--space-4) var(--space-5);
          min-height: 56px;
          font-size: var(--font-size-lg);
        }

        .input-group--lg .input-group__icon + .input-group__input {
          padding-left: calc(var(--space-5) + 24px + var(--space-3));
        }

        .input-group__input::placeholder {
          color: var(--color-text-muted);
        }

        .input-group__input:hover:not(:disabled) {
          border-color: var(--color-border-light);
        }

        .input-group__input:focus {
          outline: none;
          border-color: var(--color-primary-light);
          box-shadow: 0 0 0 3px var(--color-primary-glow);
        }

        /* Error state */
        .input-group--error .input-group__input {
          border-color: var(--color-error);
        }

        .input-group--error .input-group__input:focus {
          box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.2);
        }

        .input-group__hint {
          font-size: var(--font-size-xs);
          color: var(--color-text-muted);
          margin: 0;
        }

        .input-group__error {
          font-size: var(--font-size-xs);
          color: var(--color-error);
          margin: 0;
          animation: fadeIn 0.2s ease;
        }

        .input-group__input:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}
