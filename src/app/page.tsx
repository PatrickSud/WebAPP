'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ROUTES } from '@/constants';

// ============================================
// Root Page — Redirect based on auth state
// ============================================

export default function RootPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (isAuthenticated) {
        router.replace(ROUTES.MINISTRAR);
      } else {
        router.replace(ROUTES.LOGIN);
      }
    }
  }, [isAuthenticated, loading, router]);

  // Show loading while determining auth state
  return (
    <>
      <div className="root-loading" aria-label="Carregando aplicação…">
        <div className="root-loading__brand">
          <span className="root-loading__logo" aria-hidden="true">✦</span>
          <span className="root-loading__name">Ministério</span>
        </div>
        <div className="root-loading__spinner" />
      </div>

      <style jsx>{`
        .root-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 100dvh;
          gap: var(--space-8);
          background: var(--color-bg);
          animation: fadeIn 0.3s ease;
        }

        .root-loading__brand {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-3);
        }

        .root-loading__logo {
          font-size: 3rem;
          color: var(--color-primary-light);
          animation: pulse 2s ease-in-out infinite;
        }

        .root-loading__name {
          font-size: var(--font-size-xl);
          font-weight: var(--font-weight-bold);
          color: var(--color-text);
        }

        .root-loading__spinner {
          width: 32px;
          height: 32px;
          border: 3px solid var(--color-surface);
          border-top-color: var(--color-primary-light);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
