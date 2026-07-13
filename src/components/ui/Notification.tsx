'use client';

import React, { useState } from 'react';
import { applyUpdate } from '@/lib/version';

// ============================================
// Notification Component — Update Banner
// ============================================

export interface NotificationProps {
  currentVersion: string;
  latestVersion: string;
  visible: boolean;
  onDismiss?: () => void;
}

export default function Notification({
  currentVersion,
  latestVersion,
  visible,
  onDismiss,
}: NotificationProps) {
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdate = async () => {
    setIsUpdating(true);
    try {
      await applyUpdate();
    } catch (error) {
      console.error('[Notification] Failed to apply update:', error);
      setIsUpdating(false);
    }
  };

  if (!visible) return null;

  return (
    <>
      <div
        className={`notification ${visible ? 'notification--visible' : ''}`}
        role="alert"
        aria-live="polite"
      >
        <div className="notification__content">
          <div className="notification__icon" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </div>
          <div className="notification__text">
            <p className="notification__title">Nova versão disponível!</p>
            <p className="notification__detail">
              {currentVersion} → {latestVersion}
            </p>
          </div>
        </div>
        <div className="notification__actions">
          <button
            className="notification__btn notification__btn--update"
            onClick={handleUpdate}
            disabled={isUpdating}
            aria-label="Atualizar aplicação"
          >
            {isUpdating ? 'Atualizando…' : 'Atualizar'}
          </button>
          {onDismiss && (
            <button
              className="notification__btn notification__btn--dismiss"
              onClick={onDismiss}
              aria-label="Dispensar notificação"
            >
              Depois
            </button>
          )}
        </div>
      </div>

      <style jsx>{`
        .notification {
          position: fixed;
          top: var(--space-4);
          left: 50%;
          transform: translateX(-50%) translateY(-120%);
          z-index: var(--z-toast);
          display: flex;
          align-items: center;
          gap: var(--space-4);
          padding: var(--space-3) var(--space-5);
          background: rgba(30, 41, 59, 0.95);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(59, 130, 246, 0.3);
          border-radius: var(--radius-pill);
          box-shadow: var(--shadow-xl), 0 0 30px rgba(59, 130, 246, 0.15);
          max-width: calc(100vw - var(--space-8));
          transition: transform var(--transition-spring);
        }

        .notification--visible {
          transform: translateX(-50%) translateY(0);
        }

        .notification__content {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }

        .notification__icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: var(--color-primary-glow);
          color: var(--color-primary-light);
          flex-shrink: 0;
        }

        .notification__text {
          display: flex;
          flex-direction: column;
        }

        .notification__title {
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-semibold);
          color: var(--color-text);
          margin: 0;
        }

        .notification__detail {
          font-size: var(--font-size-xs);
          color: var(--color-text-muted);
          margin: 0;
        }

        .notification__actions {
          display: flex;
          gap: var(--space-2);
          flex-shrink: 0;
        }

        .notification__btn {
          padding: var(--space-2) var(--space-4);
          border-radius: var(--radius-pill);
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-semibold);
          border: none;
          cursor: pointer;
          transition: all var(--transition-fast);
          min-height: 36px;
        }

        .notification__btn--update {
          background: var(--color-primary);
          color: white;
        }

        .notification__btn--update:hover:not(:disabled) {
          background: var(--color-primary-light);
        }

        .notification__btn--update:disabled {
          opacity: 0.7;
          cursor: wait;
        }

        .notification__btn--dismiss {
          background: transparent;
          color: var(--color-text-muted);
        }

        .notification__btn--dismiss:hover {
          color: var(--color-text);
        }

        @media (max-width: 480px) {
          .notification {
            flex-direction: column;
            border-radius: var(--radius-lg);
            width: calc(100vw - var(--space-8));
          }

          .notification__actions {
            width: 100%;
          }

          .notification__btn--update {
            flex: 1;
          }
        }
      `}</style>
    </>
  );
}
