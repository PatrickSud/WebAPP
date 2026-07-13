'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { ROUTES, APP_VERSION } from '@/constants';

// ============================================
// Login Page — Username + Phone
// ============================================

export default function LoginPage() {
  const { login, isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ username?: string; phone?: string }>({});

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.replace(ROUTES.MINISTRAR);
    }
  }, [isAuthenticated, authLoading, router]);

  const validate = (): boolean => {
    const errors: { username?: string; phone?: string } = {};

    const trimmedUser = username.trim();
    if (!trimmedUser) {
      errors.username = 'Nome de usuário é obrigatório.';
    } else if (trimmedUser.length < 3) {
      errors.username = 'Mínimo de 3 caracteres.';
    }

    const digits = phone.replace(/\D/g, '');
    if (!digits) {
      errors.phone = 'Telefone é obrigatório.';
    } else if (digits.length < 10 || digits.length > 11) {
      errors.phone = 'Telefone inválido.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await login(username, phone);
      router.replace(ROUTES.MINISTRAR);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao fazer login.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Don't render if already authenticated (avoid flash)
  if (authLoading || isAuthenticated) {
    return null;
  }

  return (
    <>
      <div className="login-page">
        {/* Background decoration */}
        <div className="login-page__bg" aria-hidden="true">
          <div className="login-page__orb login-page__orb--1" />
          <div className="login-page__orb login-page__orb--2" />
          <div className="login-page__orb login-page__orb--3" />
        </div>

        <div className="login-page__container">
          {/* Brand */}
          <div className="login-page__brand">
            <span className="login-page__logo" aria-hidden="true">✦</span>
            <h1 className="login-page__title">Ministério</h1>
            <p className="login-page__subtitle">Entre com suas credenciais para continuar</p>
          </div>

          {/* Login Card */}
          <form className="login-page__card" onSubmit={handleSubmit} noValidate>
            {/* Global error */}
            {error && (
              <div className="login-page__alert" role="alert">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <Input
              label="Nome de usuário"
              name="username"
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setFieldErrors((prev) => ({ ...prev, username: undefined }));
              }}
              error={fieldErrors.username}
              placeholder="Ex: joao.silva"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              size="lg"
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              }
            />

            <Input
              label="Telefone"
              name="phone"
              type="tel"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                setFieldErrors((prev) => ({ ...prev, phone: undefined }));
              }}
              error={fieldErrors.phone}
              placeholder="(11) 99999-0000"
              mask="phone"
              autoComplete="tel"
              size="lg"
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
              }
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={isSubmitting}
              disabled={isSubmitting}
            >
              Entrar
            </Button>

            <p className="login-page__hint">
              Primeiro acesso? Sua conta será criada automaticamente.
            </p>
          </form>

          {/* Footer */}
          <p className="login-page__version">v{APP_VERSION}</p>
        </div>
      </div>

      <style jsx>{`
        .login-page {
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: var(--space-5);
          position: relative;
          overflow: hidden;
        }

        /* Background orbs */
        .login-page__bg {
          position: absolute;
          inset: 0;
          overflow: hidden;
          pointer-events: none;
        }

        .login-page__orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.4;
        }

        .login-page__orb--1 {
          width: 300px;
          height: 300px;
          background: var(--color-primary);
          top: -10%;
          right: -5%;
          animation: float1 8s ease-in-out infinite;
        }

        .login-page__orb--2 {
          width: 200px;
          height: 200px;
          background: var(--color-primary-dark);
          bottom: 10%;
          left: -5%;
          animation: float2 10s ease-in-out infinite;
        }

        .login-page__orb--3 {
          width: 150px;
          height: 150px;
          background: var(--color-primary-light);
          top: 40%;
          left: 60%;
          opacity: 0.15;
          animation: float3 12s ease-in-out infinite;
        }

        @keyframes float1 {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(-20px, 30px); }
        }

        @keyframes float2 {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(20px, -20px); }
        }

        @keyframes float3 {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(-30px, 15px); }
        }

        .login-page__container {
          width: 100%;
          max-width: 420px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-8);
          position: relative;
          z-index: 1;
          animation: fadeInUp 0.6s ease both;
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Brand */
        .login-page__brand {
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-2);
        }

        .login-page__logo {
          font-size: 3rem;
          color: var(--color-primary-light);
          line-height: 1;
          animation: pulse 3s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.05); }
        }

        .login-page__title {
          font-size: var(--font-size-2xl);
          font-weight: var(--font-weight-bold);
          color: var(--color-text);
          margin: 0;
        }

        .login-page__subtitle {
          font-size: var(--font-size-base);
          color: var(--color-text-muted);
          margin: 0;
        }

        /* Card */
        .login-page__card {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: var(--space-5);
          padding: var(--space-8);
          background: rgba(30, 41, 59, 0.6);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: var(--radius-xl);
          box-shadow: var(--shadow-xl);
        }

        .login-page__alert {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          padding: var(--space-3) var(--space-4);
          background: var(--color-error-bg);
          border: 1px solid rgba(239, 68, 68, 0.2);
          border-radius: var(--radius-md);
          color: var(--color-error);
          font-size: var(--font-size-sm);
          animation: fadeIn 0.3s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .login-page__hint {
          text-align: center;
          font-size: var(--font-size-xs);
          color: var(--color-text-muted);
          margin: 0;
        }

        .login-page__version {
          font-size: var(--font-size-xs);
          color: var(--color-text-muted);
          opacity: 0.5;
          margin: 0;
        }

        /* Responsive */
        @media (max-width: 480px) {
          .login-page {
            padding: var(--space-4);
            align-items: flex-start;
            padding-top: 15vh;
          }

          .login-page__card {
            padding: var(--space-6);
          }
        }
      `}</style>
    </>
  );
}
