'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ROUTES } from '@/constants';

// ============================================
// AuthGuard — Protects routes, redirects to login
// ============================================

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace(ROUTES.LOGIN);
    }
  }, [isAuthenticated, loading, router]);

  if (loading) {
    return (
      <>
        <div className="auth-guard-loading" aria-label="Carregando…">
          <div className="auth-guard-loading__spinner" />
          <p className="auth-guard-loading__text">Carregando…</p>
        </div>

        <style jsx>{`
          .auth-guard-loading {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100dvh;
            gap: var(--space-4);
            background: var(--color-bg);
          }

          .auth-guard-loading__spinner {
            width: 40px;
            height: 40px;
            border: 3px solid var(--color-surface);
            border-top-color: var(--color-primary-light);
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }

          .auth-guard-loading__text {
            color: var(--color-text-muted);
            font-size: var(--font-size-base);
          }

          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
