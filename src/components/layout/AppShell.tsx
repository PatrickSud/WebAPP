'use client';

import React from 'react';
import FloatingNav from './FloatingNav';
import Notification from '@/components/ui/Notification';
import { useVersionCheck } from '@/hooks/useVersionCheck';
import { useAuth } from '@/contexts/AuthContext';
import { useNotificationScheduler } from '@/hooks/useNotificationScheduler';
import { APP_VERSION } from '@/constants';

// ============================================
// AppShell — Main layout wrapper
// ============================================

interface AppShellProps {
  children: React.ReactNode;
  showNav?: boolean;
  showHeader?: boolean;
}

export default function AppShell({
  children,
  showNav = true,
  showHeader = true,
}: AppShellProps) {
  const { versionInfo, hasUpdate, dismiss } = useVersionCheck();
  const { user, logout } = useAuth();

  // Ativa a sincronização de notificações multidispositivo em tempo real
  useNotificationScheduler();

  return (
    <>
      <div className="app-shell">
        {/* Version update notification */}
        {versionInfo && (
          <Notification
            currentVersion={versionInfo.current}
            latestVersion={versionInfo.latest}
            visible={hasUpdate}
            onDismiss={dismiss}
          />
        )}

        {/* Header */}
        {showHeader && (
          <header className="app-shell__header">
            <div className="app-shell__header-content">
              <div className="app-shell__brand">
                <span className="app-shell__logo" aria-hidden="true">✦</span>
                <h1 className="app-shell__title">Ministério</h1>
              </div>
              {user && (
                <div className="app-shell__user-area">
                  <span className="app-shell__username">
                    {user.username}
                  </span>
                  <button
                    className="app-shell__logout"
                    onClick={logout}
                    aria-label="Sair da conta"
                    title="Sair"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
            <div className="app-shell__version">v{APP_VERSION}</div>
          </header>
        )}

        {/* Main Content */}
        <main className="app-shell__content">
          {children}
        </main>

        {/* Floating Navigation */}
        {showNav && <FloatingNav />}
      </div>

      <style jsx>{`
        .app-shell {
          min-height: 100dvh;
          display: flex;
          flex-direction: column;
          background: var(--color-bg);
        }

        .app-shell__header {
          position: sticky;
          top: 0;
          z-index: var(--z-sticky);
          padding: var(--space-4) var(--space-5);
          background: rgba(15, 23, 42, 0.9);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }

        .app-shell__header-content {
          display: flex;
          align-items: center;
          justify-content: space-between;
          max-width: var(--content-max-width);
          margin: 0 auto;
          width: 100%;
        }

        .app-shell__brand {
          display: flex;
          align-items: center;
          gap: var(--space-2);
        }

        .app-shell__logo {
          font-size: var(--font-size-xl);
          color: var(--color-primary-light);
          line-height: 1;
        }

        .app-shell__title {
          font-size: var(--font-size-lg);
          font-weight: var(--font-weight-bold);
          color: var(--color-text);
          margin: 0;
        }

        .app-shell__user-area {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }

        .app-shell__username {
          font-size: var(--font-size-sm);
          color: var(--color-text-secondary);
          font-weight: var(--font-weight-medium);
        }

        .app-shell__logout {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          border-radius: var(--radius-sm);
          background: transparent;
          color: var(--color-text-muted);
          border: none;
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .app-shell__logout:hover {
          background: var(--color-surface);
          color: var(--color-error);
        }

        .app-shell__version {
          font-size: 0.6875rem;
          color: var(--color-text-muted);
          text-align: center;
          margin-top: var(--space-1);
          max-width: var(--content-max-width);
          margin-left: auto;
          margin-right: auto;
          opacity: 0.6;
        }

        .app-shell__content {
          flex: 1;
          padding: var(--space-5);
          padding-bottom: calc(var(--nav-height) + var(--space-10));
          max-width: var(--content-max-width);
          margin: 0 auto;
          width: 100%;
          animation: fadeIn 0.3s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </>
  );
}
