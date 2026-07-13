'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { NAV_ITEMS, ROUTES } from '@/constants';
import { useAuth } from '@/contexts/AuthContext';

// ============================================
// FloatingNav — Pill-style bottom navigation
// ============================================

/** Inline SVG icons */
const icons: Record<string, React.ReactNode> = {
  ministrar: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" />
      <path d="M8 7h6" />
      <path d="M8 11h8" />
    </svg>
  ),
  home: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
      <path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  ),
  admin: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
};

export default function FloatingNav() {
  const pathname = usePathname();
  const { user } = useAuth();

  const items = React.useMemo(() => {
    const list = [...NAV_ITEMS] as Array<{ id: string; label: string; href: string }>;
    if (user?.isAdmin) {
      list.push({
        id: 'admin',
        label: 'Painel',
        href: ROUTES.ADMIN,
      });
    }
    return list;
  }, [user]);

  return (
    <>
      <nav className="floating-nav" aria-label="Menu principal" role="navigation">
        <div className="floating-nav__container">
          {items.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');

            return (
              <Link
                key={item.id}
                href={item.href}
                className={`floating-nav__item ${isActive ? 'floating-nav__item--active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className="floating-nav__icon" aria-hidden="true">
                  {icons[item.id]}
                </span>
                <span className="floating-nav__label">{item.label}</span>
                {isActive && <span className="floating-nav__indicator" />}
              </Link>
            );
          })}
        </div>
      </nav>

      <style jsx>{`
        .floating-nav {
          position: fixed;
          bottom: var(--space-6);
          left: 50%;
          transform: translateX(-50%);
          z-index: var(--z-nav);
          animation: slideUp 0.5s var(--transition-spring) both;
          animation-delay: 0.2s;
        }

        @supports (padding: env(safe-area-inset-bottom)) {
          .floating-nav {
            bottom: calc(var(--space-6) + env(safe-area-inset-bottom));
          }
        }

        .floating-nav__container {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-2);
          background: rgba(15, 23, 42, 0.85);
          backdrop-filter: blur(20px) saturate(180%);
          -webkit-backdrop-filter: blur(20px) saturate(180%);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: var(--radius-pill);
          box-shadow: var(--shadow-xl), 0 0 40px rgba(0, 0, 0, 0.3);
        }

        .floating-nav__item {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 2px;
          padding: var(--space-2) var(--space-5);
          border-radius: var(--radius-pill);
          color: var(--color-text-muted);
          text-decoration: none;
          transition: all var(--transition-base);
          min-width: var(--min-touch-target);
          min-height: var(--min-touch-target);
          cursor: pointer;
          user-select: none;
          -webkit-user-select: none;
        }

        .floating-nav__item:hover {
          color: var(--color-text-secondary);
          background: rgba(255, 255, 255, 0.05);
        }

        .floating-nav__item--active {
          color: var(--color-primary-lighter);
          background: rgba(59, 130, 246, 0.12);
        }

        .floating-nav__item--active:hover {
          color: var(--color-primary-lighter);
          background: rgba(59, 130, 246, 0.18);
        }

        .floating-nav__icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          transition: transform var(--transition-fast);
        }

        .floating-nav__item--active .floating-nav__icon {
          transform: scale(1.1);
        }

        .floating-nav__label {
          font-size: 0.6875rem;
          font-weight: var(--font-weight-medium);
          letter-spacing: 0.02em;
          line-height: 1;
        }

        .floating-nav__item--active .floating-nav__label {
          font-weight: var(--font-weight-semibold);
        }

        .floating-nav__indicator {
          position: absolute;
          top: 6px;
          right: 50%;
          transform: translateX(50%);
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: var(--color-primary-light);
          box-shadow: 0 0 6px var(--color-primary-light);
        }

        @keyframes slideUp {
          from {
            transform: translateX(-50%) translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateX(-50%) translateY(0);
            opacity: 1;
          }
        }

        @media (max-width: 360px) {
          .floating-nav__item {
            padding: var(--space-2) var(--space-4);
          }
        }
      `}</style>
    </>
  );
}
