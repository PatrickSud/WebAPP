'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AuthGuard from '@/components/auth/AuthGuard';
import AppShell from '@/components/layout/AppShell';
import Button from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { getISOWeekDetails } from '@/lib/date';
import { getItem, setItem } from '@/lib/localStorage';
import { getFirebaseDb, isMockMode } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import type { MinistrationDocument } from '@/types';

export default function HomePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<MinistrationDocument | null>(null);
  const [weekDetails] = useState(() => getISOWeekDetails());
  const [isSaving, setIsSaving] = useState(false);

  // Weekly initialization, checking for resets and configuration redirects
  useEffect(() => {
    if (!user) return;

    const { weekId, weekNumber, year } = getISOWeekDetails();

    const initDashboard = async () => {
      try {
        const currentCacheKey = `ministerio:ministration:${user.uid}:${weekId}`;
        let currentWeekDoc = getItem<MinistrationDocument>(currentCacheKey);

        // Fetch from Firestore if not in mock mode and not in cache
        if (!currentWeekDoc && !isMockMode()) {
          try {
            const docRef = doc(getFirebaseDb(), 'users', user.uid, 'ministration', weekId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
              currentWeekDoc = docSnap.data() as MinistrationDocument;
              setItem(currentCacheKey, currentWeekDoc);
            }
          } catch (err) {
            console.error('Error fetching current week doc from Firestore:', err);
          }
        }

        // Scan local storage for the latest configured week to check for a weekly reset
        let latestCachedWeekId: string | null = null;
        let previousWeekDoc: MinistrationDocument | null = null;

        if (typeof window !== 'undefined') {
          const prefix = `ministerio:ministration:${user.uid}:`;
          const cachedWeekIds: string[] = [];

          for (let i = 0; i < window.localStorage.length; i++) {
            const key = window.localStorage.key(i);
            if (key?.startsWith(prefix)) {
              const wId = key.substring(prefix.length);
              if (wId < weekId) {
                cachedWeekIds.push(wId);
              }
            }
          }

          if (cachedWeekIds.length > 0) {
            cachedWeekIds.sort();
            latestCachedWeekId = cachedWeekIds[cachedWeekIds.length - 1];
            previousWeekDoc = getItem<MinistrationDocument>(prefix + latestCachedWeekId);
          }
        }

        // Weekly Reset Logic (Client-side)
        // If a new week has started and we don't have it configured/created yet, clone from previous
        if (!currentWeekDoc && previousWeekDoc) {
          const resetDoc: MinistrationDocument = {
            weekId,
            weekNumber,
            year,
            weekConfigured: false,
            absence: {
              asked: false,
              confirmed: false,
              personName: null,
              timestamp: null,
            },
            contact: {
              willContact: false,
              confirmationTimestamp: null,
              contactCompleted: false,
              completedTimestamp: null,
            },
            ministry: {
              hasPartner: previousWeekDoc.ministry.hasPartner,
              partnerName: previousWeekDoc.ministry.partnerName,
              partnerConfirmedAt: previousWeekDoc.ministry.partnerConfirmedAt,
              candidates: previousWeekDoc.ministry.candidates || [],
            },
            people: (previousWeekDoc.people || []).map(p => ({
              id: p.id,
              name: p.name,
              addedAt: p.addedAt,
              checkedInAt: null, // Reset check-ins for the new week
            })),
            notifications: [],
            updatedAt: Date.now(),
          };

          setItem(currentCacheKey, resetDoc);

          if (!isMockMode()) {
            try {
              const docRef = doc(getFirebaseDb(), 'users', user.uid, 'ministration', weekId);
              await setDoc(docRef, resetDoc);
            } catch (err) {
              console.error('Error saving reset doc in Firestore:', err);
            }
          }

          router.replace('/ministrar');
          return;
        }

        // If no current week exists and no previous cached week, go configure
        if (!currentWeekDoc) {
          router.replace('/ministrar');
          return;
        }

        // If current week document exists but is not configured, redirect to setup
        if (!currentWeekDoc.weekConfigured) {
          router.replace('/ministrar');
          return;
        }

        // Data matches configured week - display dashboard
        setData(currentWeekDoc);
      } catch (err) {
        console.error('Error initializing dashboard:', err);
      } finally {
        setLoading(false);
      }
    };

    initDashboard();
  }, [user, router]);

  // Handle Quick Check-in Toggle for a person
  const handleCheckInToggle = useCallback(async (personId: string, isChecked: boolean) => {
    if (!data || !user || !weekDetails) return;

    const updatedPeople = data.people.map(p => {
      if (p.id === personId) {
        return {
          ...p,
          checkedInAt: isChecked ? Date.now() : null
        };
      }
      return p;
    });

    const updatedDoc: MinistrationDocument = {
      ...data,
      people: updatedPeople,
      updatedAt: Date.now()
    };

    setData(updatedDoc);
    const cacheKey = `ministerio:ministration:${user.uid}:${weekDetails.weekId}`;
    setItem(cacheKey, updatedDoc);

    if (!isMockMode()) {
      try {
        const docRef = doc(getFirebaseDb(), 'users', user.uid, 'ministration', weekDetails.weekId);
        await setDoc(docRef, updatedDoc);
      } catch (err) {
        console.error('Error updating check-in in Firestore:', err);
      }
    }
  }, [data, user, weekDetails]);

  // Confirm contact with absent person (deactivates pending notifications)
  const handleConfirmContact = useCallback(async () => {
    if (!data || !user || !weekDetails) return;

    setIsSaving(true);
    const updatedDoc: MinistrationDocument = {
      ...data,
      contact: {
        ...data.contact,
        contactCompleted: true,
        completedTimestamp: Date.now()
      },
      notifications: (data.notifications || []).map(n => ({
        ...n,
        sent: true // Mark as sent to disable pending notification schedules
      })),
      updatedAt: Date.now()
    };

    try {
      setData(updatedDoc);
      const cacheKey = `ministerio:ministration:${user.uid}:${weekDetails.weekId}`;
      setItem(cacheKey, updatedDoc);

      if (!isMockMode()) {
        const docRef = doc(getFirebaseDb(), 'users', user.uid, 'ministration', weekDetails.weekId);
        await setDoc(docRef, updatedDoc);
      }
    } catch (err) {
      console.error('Error confirming contact in Firestore:', err);
      alert('Erro ao registrar confirmação. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  }, [data, user, weekDetails]);

  // Swap Partner (reconfigures partner and redirects to wizard stage 2)
  const handleSwapPartner = async () => {
    if (!data || !user || !weekDetails) return;

    if (!confirm('Deseja realmente trocar de dupla? Isso irá redefinir as informações da dupla e abrir o formulário na Etapa 2.')) {
      return;
    }

    setIsSaving(true);
    const updatedDoc: MinistrationDocument = {
      ...data,
      ministry: {
        hasPartner: false,
        partnerName: null,
        partnerConfirmedAt: null,
        candidates: []
      },
      weekConfigured: false,
      updatedAt: Date.now()
    };

    try {
      const cacheKey = `ministerio:ministration:${user.uid}:${weekDetails.weekId}`;
      setItem(cacheKey, updatedDoc);

      if (!isMockMode()) {
        const docRef = doc(getFirebaseDb(), 'users', user.uid, 'ministration', weekDetails.weekId);
        await setDoc(docRef, updatedDoc);
      }

      router.push('/ministrar?step=2');
    } catch (err) {
      console.error('Error swapping partner:', err);
      alert('Erro ao redefinir dupla. Tente novamente.');
      setIsSaving(false);
    }
  };

  // Render Loader
  if (loading || !data || !weekDetails) {
    return (
      <AuthGuard>
        <AppShell>
          <div className="home-loading">
            <div className="home-loading__spinner" />
            <p className="home-loading__text">Carregando painel…</p>
          </div>
          <style jsx>{`
            .home-loading {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 50vh;
              gap: var(--space-4);
            }
            .home-loading__spinner {
              width: 40px;
              height: 40px;
              border: 3px solid var(--color-surface);
              border-top-color: var(--color-primary-light);
              border-radius: 50%;
              animation: spin 0.8s linear infinite;
            }
            .home-loading__text {
              color: var(--color-text-muted);
              font-size: var(--font-size-base);
            }
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </AppShell>
      </AuthGuard>
    );
  }

  const showAbsenceCard = data.absence.confirmed && data.contact.willContact;

  return (
    <AuthGuard>
      <AppShell>
        <div className="dashboard-container">
          
          {/* Welcome Header */}
          <header className="dashboard-header animate-fade-in">
            <div className="dashboard-header__left">
              <h2 className="dashboard-title">Olá, {user?.username}! ✨</h2>
              <p className="dashboard-subtitle">Acompanhe as suas ministrações da semana.</p>
            </div>
            <span className="week-badge">Semana {weekDetails.weekId}</span>
          </header>

          <div className="dashboard-grid">
            
            {/* Left Column: Absence & Partner info */}
            <div className="dashboard-col">
              
              {/* Status da Ausência Card */}
              {showAbsenceCard && (
                <section className={`card-absence glass animate-fade-in ${!data.contact.contactCompleted ? 'highlight-accent' : ''}`}>
                  <div className="card-header">
                    <span className="card-icon" aria-hidden="true">
                      {data.contact.contactCompleted ? '✅' : '🔔'}
                    </span>
                    <h3 className="card-title">Acompanhamento de Ausência</h3>
                  </div>

                  <div className="card-content">
                    {data.contact.contactCompleted ? (
                      <div className="absence-completed">
                        <p className="absence-msg">
                          Contato com <strong className="white-text">{data.absence.personName}</strong> realizado com sucesso!
                        </p>
                        {data.contact.completedTimestamp && (
                          <span className="completed-time">
                            Confirmado em: {new Date(data.contact.completedTimestamp).toLocaleString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="absence-pending">
                        <p className="absence-msg">
                          Lembre-se de entrar em contato com <strong className="white-text">{data.absence.personName}</strong> para saber como está.
                        </p>
                        <Button
                          type="button"
                          onClick={handleConfirmContact}
                          disabled={isSaving}
                          loading={isSaving}
                          className="confirm-btn-glow"
                        >
                          Confirmar Contato Realizado
                        </Button>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Dupla Atual Card */}
              <section className="card-partner glass animate-fade-in">
                <div className="card-header">
                  <span className="card-icon" aria-hidden="true">🤝</span>
                  <h3 className="card-title">Sua Dupla</h3>
                </div>
                <div className="card-content">
                  {data.ministry.hasPartner ? (
                    <div className="partner-details">
                      <p className="partner-name">{data.ministry.partnerName}</p>
                      <p className="partner-sub">Dupla de ministração registrada.</p>
                    </div>
                  ) : (
                    <div className="partner-candidates">
                      <p className="partner-sub">Você não possui dupla de ministração fixa cadastrada.</p>
                      {data.ministry.candidates && data.ministry.candidates.length > 0 && (
                        <div className="candidates-block">
                          <span className="candidates-label">Candidatos sugeridos:</span>
                          <ul className="candidates-list">
                            {data.ministry.candidates.map((name, i) => (
                              <li key={i} className="candidate-item">✦ {name}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleSwapPartner}
                    disabled={isSaving}
                    className="swap-btn"
                  >
                    Trocar Dupla
                  </Button>
                </div>
              </section>

            </div>

            {/* Right Column: Ministered People Check-in */}
            <div className="dashboard-col">
              
              <section className="card-people glass animate-fade-in">
                <div className="card-header">
                  <span className="card-icon" aria-hidden="true">👥</span>
                  <h3 className="card-title">Lista de Ministrados</h3>
                </div>
                <div className="card-content">
                  <p className="card-desc">
                    Marque as pessoas que receberam seu contato ou visita durante esta semana.
                  </p>

                  <div className="people-list">
                    {data.people && data.people.length > 0 ? (
                      data.people.map(p => (
                        <label key={p.id} className="custom-checkbox">
                          <input
                            type="checkbox"
                            className="custom-checkbox__input"
                            checked={!!p.checkedInAt}
                            onChange={(e) => handleCheckInToggle(p.id, e.target.checked)}
                          />
                          <span className="custom-checkbox__box">
                            <span className="custom-checkbox__checkmark">✓</span>
                          </span>
                          <div className="custom-checkbox__label-container">
                            <span className="custom-checkbox__name">{p.name}</span>
                            {p.checkedInAt && (
                              <span className="custom-checkbox__date">
                                Último contato: {new Date(p.checkedInAt).toLocaleString('pt-BR', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            )}
                          </div>
                        </label>
                      ))
                    ) : (
                      <p className="empty-people">Nenhuma pessoa cadastrada para ministrar.</p>
                    )}
                  </div>
                </div>
              </section>

            </div>

          </div>

        </div>

        <style jsx>{`
          .dashboard-container {
            display: flex;
            flex-direction: column;
            gap: var(--space-6);
            width: 100%;
          }

          /* Header Styling */
          .dashboard-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: var(--space-4);
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            padding-bottom: var(--space-4);
          }

          .dashboard-title {
            font-size: var(--font-size-xl);
            font-weight: var(--font-weight-bold);
            color: var(--color-text);
            margin: 0;
          }

          .dashboard-subtitle {
            font-size: var(--font-size-sm);
            color: var(--color-text-muted);
            margin: var(--space-1) 0 0 0;
          }

          .week-badge {
            background: var(--color-primary-dark);
            color: var(--color-primary-lighter);
            padding: var(--space-2) var(--space-4);
            border-radius: var(--radius-pill);
            font-size: var(--font-size-xs);
            font-weight: var(--font-weight-semibold);
            border: 1px solid var(--color-primary);
            flex-shrink: 0;
            box-shadow: 0 0 10px rgba(59, 130, 246, 0.1);
          }

          /* Layout Grid */
          .dashboard-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: var(--space-6);
          }

          @media (min-width: 768px) {
            .dashboard-grid {
              grid-template-columns: 1fr 1.1fr;
            }
          }

          .dashboard-col {
            display: flex;
            flex-direction: column;
            gap: var(--space-6);
          }

          /* Card Generic Styling */
          .glass {
            background: rgba(30, 41, 59, 0.6);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.06);
            border-radius: var(--radius-lg);
            padding: var(--space-5);
            box-shadow: var(--shadow-md);
            transition: transform var(--transition-fast), border-color var(--transition-fast);
          }

          .glass:hover {
            border-color: rgba(255, 255, 255, 0.1);
          }

          .card-header {
            display: flex;
            align-items: center;
            gap: var(--space-3);
            margin-bottom: var(--space-4);
          }

          .card-icon {
            font-size: 1.5rem;
            line-height: 1;
          }

          .card-title {
            font-size: var(--font-size-base);
            font-weight: var(--font-weight-bold);
            color: var(--color-primary-lighter);
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin: 0;
          }

          .card-content {
            display: flex;
            flex-direction: column;
            gap: var(--space-4);
          }

          .card-desc {
            font-size: var(--font-size-sm);
            color: var(--color-text-secondary);
            margin: 0;
            line-height: var(--line-height-normal);
          }

          /* Absence Card Specifics */
          .card-absence.highlight-accent {
            border: 1.5px solid var(--color-primary-light);
            background: linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(30, 58, 138, 0.5) 100%);
            box-shadow: 0 4px 20px rgba(59, 130, 246, 0.15);
          }

          .absence-msg {
            font-size: var(--font-size-base);
            color: var(--color-text-secondary);
            margin: 0 0 var(--space-3) 0;
            line-height: var(--line-height-relaxed);
          }

          .white-text {
            color: white;
            font-weight: var(--font-weight-semibold);
          }

          .completed-time {
            display: inline-block;
            font-size: var(--font-size-xs);
            color: var(--color-success);
            font-weight: var(--font-weight-medium);
            background: var(--color-success-bg);
            padding: var(--space-1) var(--space-3);
            border-radius: var(--radius-sm);
          }

          .absence-completed {
            display: flex;
            flex-direction: column;
            gap: var(--space-2);
          }

          .confirm-btn-glow {
            box-shadow: 0 0 15px rgba(59, 130, 246, 0.4);
            width: 100%;
          }

          /* Partner Card Specifics */
          .partner-name {
            font-size: var(--font-size-xl);
            font-weight: var(--font-weight-bold);
            color: white;
            margin: 0;
          }

          .partner-sub {
            font-size: var(--font-size-xs);
            color: var(--color-text-muted);
            margin: var(--space-1) 0 0 0;
          }

          .candidates-block {
            margin-top: var(--space-3);
            display: flex;
            flex-direction: column;
            gap: var(--space-2);
          }

          .candidates-label {
            font-size: var(--font-size-xs);
            font-weight: var(--font-weight-semibold);
            color: var(--color-text-secondary);
          }

          .candidates-list {
            display: flex;
            flex-direction: column;
            gap: var(--space-1);
          }

          .candidate-item {
            font-size: var(--font-size-sm);
            color: var(--color-text-secondary);
            padding-left: var(--space-2);
          }

          .swap-btn {
            width: 100%;
            margin-top: var(--space-2);
          }

          /* People Checkbox List */
          .people-list {
            display: flex;
            flex-direction: column;
            gap: var(--space-3);
            margin-top: var(--space-2);
          }

          .custom-checkbox {
            position: relative;
            display: flex;
            align-items: center;
            gap: var(--space-3);
            cursor: pointer;
            padding: var(--space-3) var(--space-4);
            border-radius: var(--radius-md);
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid var(--color-border);
            transition: all var(--transition-fast);
            user-select: none;
          }

          .custom-checkbox:hover {
            background: rgba(255, 255, 255, 0.04);
            border-color: var(--color-border-light);
            transform: translateY(-1px);
          }

          .custom-checkbox__input {
            position: absolute;
            opacity: 0;
            cursor: pointer;
            height: 0;
            width: 0;
          }

          .custom-checkbox__box {
            height: 22px;
            width: 22px;
            border-radius: 50%;
            border: 2px solid var(--color-text-muted);
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all var(--transition-spring);
            flex-shrink: 0;
          }

          .custom-checkbox__input:checked ~ .custom-checkbox__box {
            background: var(--color-success);
            border-color: var(--color-success);
            transform: scale(1.08);
            box-shadow: 0 0 10px rgba(34, 197, 94, 0.4);
          }

          .custom-checkbox__checkmark {
            color: white;
            font-size: 12px;
            font-weight: bold;
            opacity: 0;
            transform: scale(0.5);
            transition: all var(--transition-fast);
          }

          .custom-checkbox__input:checked ~ .custom-checkbox__box .custom-checkbox__checkmark {
            opacity: 1;
            transform: scale(1);
          }

          .custom-checkbox__label-container {
            display: flex;
            flex-direction: column;
            gap: 2px;
          }

          .custom-checkbox__name {
            font-weight: var(--font-weight-medium);
            color: var(--color-text-secondary);
            transition: all var(--transition-fast);
          }

          .custom-checkbox__input:checked ~ .custom-checkbox__label-container .custom-checkbox__name {
            color: var(--color-text-muted);
            text-decoration: line-through;
          }

          .custom-checkbox__date {
            font-size: var(--font-size-xs);
            color: var(--color-success);
            opacity: 0.9;
          }

          .empty-people {
            font-size: var(--font-size-sm);
            color: var(--color-text-muted);
            font-style: italic;
            text-align: center;
            padding: var(--space-4);
          }

          /* Animations */
          .animate-fade-in {
            animation: fadeIn 0.4s ease-out both;
          }

          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: translateY(8px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}</style>
      </AppShell>
    </AuthGuard>
  );
}
