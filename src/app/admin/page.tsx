'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AppShell from '@/components/layout/AppShell';
import { getISOWeekDetails } from '@/lib/date';
import { subscribeToAllUsers, subscribeToUserMinistration } from '@/lib/firestore';
import type { UserProfile, MinistrationDocument } from '@/types';

// ============================================
// Helper to normalize and format phone for WA
// ============================================
const getWhatsAppUrl = (phone: string, message: string) => {
  const digits = phone.replace(/\D/g, '');
  const formattedPhone = digits.startsWith('55') ? digits : `55${digits}`;
  return `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
};

export default function AdminDashboardPage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [ministrations, setMinistrations] = useState<Record<string, MinistrationDocument>>({});
  const [loadingData, setLoadingData] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'configured' | 'pending'>('all');
  const [contactFilter, setContactFilter] = useState<'all' | 'pending'>('all');
  const [partnerFilter, setPartnerFilter] = useState<'all' | 'has_partner' | 'no_partner'>('all');

  const { weekId, weekNumber } = getISOWeekDetails();

  // Route protection
  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        router.replace('/login');
      } else if (!user?.isAdmin) {
        router.replace('/home');
      }
    }
  }, [authLoading, isAuthenticated, user, router]);

  // Subscribe to all users in real-time
  useEffect(() => {
    if (!user?.isAdmin) return;

    const unsubUsers = subscribeToAllUsers((fetchedUsers) => {
      setUsers(fetchedUsers);
      setLoadingData(false);
    });

    return () => unsubUsers();
  }, [user]);

  // Subscribe to ministration documents of users in real-time
  useEffect(() => {
    if (users.length === 0) return;

    const unsubs = users.map((u) => {
      return subscribeToUserMinistration(u.uid, weekId, (data) => {
        setMinistrations((prev) => {
          if (!data) {
            const next = { ...prev };
            delete next[u.uid];
            return next;
          }
          return { ...prev, [u.uid]: data };
        });
      });
    });

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, [users, weekId]);

  // Metrics
  const metrics = useMemo(() => {
    const totalUsers = users.length;
    let configuredCount = 0;
    let pendingContactsCount = 0;
    let totalAbsenteesCount = 0;

    users.forEach((u) => {
      const minData = ministrations[u.uid];
      if (minData) {
        if (minData.weekConfigured) {
          configuredCount++;
        }
        if (minData.absence?.confirmed && minData.absence?.personName) {
          totalAbsenteesCount++;
          if (minData.contact?.willContact && !minData.contact?.contactCompleted) {
            pendingContactsCount++;
          }
        }
      }
    });

    const configuredPercentage = totalUsers > 0 ? Math.round((configuredCount / totalUsers) * 100) : 0;

    return {
      totalUsers,
      configuredCount,
      configuredPercentage,
      pendingContactsCount,
      totalAbsenteesCount,
    };
  }, [users, ministrations]);

  // Filtered list
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // 1. Search term
      const matchesSearch =
        u.username.toLowerCase().includes(search.toLowerCase()) ||
        u.phone.includes(search);

      if (!matchesSearch) return false;

      const minData = ministrations[u.uid];
      const isConfigured = minData?.weekConfigured ?? false;

      // 2. Status filter
      if (statusFilter === 'configured' && !isConfigured) return false;
      if (statusFilter === 'pending' && isConfigured) return false;

      // 3. Contact filter
      const hasPendingContact =
        minData?.absence?.confirmed &&
        minData?.contact?.willContact &&
        !minData?.contact?.contactCompleted;
      if (contactFilter === 'pending' && !hasPendingContact) return false;

      // 4. Partner filter
      const hasPartner = minData?.ministry?.hasPartner ?? false;
      if (partnerFilter === 'has_partner' && !hasPartner) return false;
      if (partnerFilter === 'no_partner' && hasPartner) return false;

      return true;
    });
  }, [users, ministrations, search, statusFilter, contactFilter, partnerFilter]);

  // Clear all filters helper
  const handleClearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setContactFilter('all');
    setPartnerFilter('all');
  };

  // Rendering Loading State
  if (authLoading || !user?.isAdmin || loadingData) {
    return (
      <AppShell showNav={false} showHeader={false}>
        <div className="admin-loading" role="status" aria-label="Verificando acesso de administrador…">
          <div className="admin-loading__spinner" />
          <p className="admin-loading__text">Carregando painel…</p>
        </div>

        <style jsx>{`
          .admin-loading {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 80dvh;
            gap: var(--space-4);
          }
          .admin-loading__spinner {
            width: 40px;
            height: 40px;
            border: 3px solid var(--color-surface);
            border-top-color: var(--color-primary-light);
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }
          .admin-loading__text {
            color: var(--color-text-secondary);
            font-size: var(--font-size-base);
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </AppShell>
    );
  }

  return (
    <AppShell showNav={true} showHeader={true}>
      <div className="admin-dashboard">
        
        {/* Header Title */}
        <div className="admin-dashboard__header">
          <div>
            <h2 className="admin-dashboard__title">Painel do Administrador</h2>
            <p className="admin-dashboard__subtitle">Monitoramento em tempo real do andamento ministerial</p>
          </div>
          <div className="week-badge">
            Semana {weekNumber} ({weekId})
          </div>
        </div>

        {/* Metric Cards Grid */}
        <section className="metrics-grid" aria-label="Métricas da semana">
          <div className="metric-card glass">
            <span className="metric-card__icon" aria-hidden="true">👥</span>
            <div className="metric-card__details">
              <span className="metric-card__value">{metrics.totalUsers}</span>
              <span className="metric-card__label">Ministradores</span>
            </div>
          </div>

          <div className="metric-card glass">
            <span className="metric-card__icon" aria-hidden="true">📝</span>
            <div className="metric-card__details">
              <span className="metric-card__value">{metrics.configuredPercentage}%</span>
              <span className="metric-card__label">Formulários ({metrics.configuredCount})</span>
            </div>
            <div className="metric-card__progress-bar">
              <div 
                className="metric-card__progress-fill" 
                style={{ width: `${metrics.configuredPercentage}%` }} 
              />
            </div>
          </div>

          <div className="metric-card glass highlight-warning">
            <span className="metric-card__icon" aria-hidden="true">⏳</span>
            <div className="metric-card__details">
              <span className="metric-card__value">{metrics.pendingContactsCount}</span>
              <span className="metric-card__label">Contatos Pendentes</span>
            </div>
          </div>

          <div className="metric-card glass">
            <span className="metric-card__icon" aria-hidden="true">🚨</span>
            <div className="metric-card__details">
              <span className="metric-card__value">{metrics.totalAbsenteesCount}</span>
              <span className="metric-card__label">Ausentes Relatados</span>
            </div>
          </div>
        </section>

        {/* Filter Toolbar */}
        <section className="filters-section glass" aria-label="Filtros e Busca">
          <div className="search-box">
            <svg className="search-box__icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Buscar por nome ou telefone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="search-box__input"
              aria-label="Buscar ministrador"
            />
          </div>

          <div className="filter-dropdowns">
            <div className="filter-group">
              <label htmlFor="status-select" className="filter-group__label">Formulário:</label>
              <select
                id="status-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | 'configured' | 'pending')}
                className="filter-group__select"
              >
                <option value="all">Todos</option>
                <option value="configured">Preencheram</option>
                <option value="pending">Pendentes</option>
              </select>
            </div>

            <div className="filter-group">
              <label htmlFor="contact-select" className="filter-group__label">Contatos:</label>
              <select
                id="contact-select"
                value={contactFilter}
                onChange={(e) => setContactFilter(e.target.value as 'all' | 'pending')}
                className="filter-group__select"
              >
                <option value="all">Todos</option>
                <option value="pending">Contatos Pendentes</option>
              </select>
            </div>

            <div className="filter-group">
              <label htmlFor="partner-select" className="filter-group__label">Duplas:</label>
              <select
                id="partner-select"
                value={partnerFilter}
                onChange={(e) => setPartnerFilter(e.target.value as 'all' | 'has_partner' | 'no_partner')}
                className="filter-group__select"
              >
                <option value="all">Todos</option>
                <option value="has_partner">Com Dupla</option>
                <option value="no_partner">Sem Dupla</option>
              </select>
            </div>
          </div>
        </section>

        {/* Users List Area */}
        <section className="users-list" aria-label="Lista de Ministradores">
          <div className="users-list__header">
            <h3 className="users-list__title">Ministradores ({filteredUsers.length})</h3>
          </div>

          {filteredUsers.length > 0 ? (
            <div className="users-list__grid">
              {filteredUsers.map((u) => {
                const minData = ministrations[u.uid];
                const isConfigured = minData?.weekConfigured ?? false;
                const hasPartner = minData?.ministry?.hasPartner ?? false;
                const partnerName = minData?.ministry?.partnerName;
                const candidates = minData?.ministry?.candidates || [];
                const people = minData?.people || [];
                const absence = minData?.absence;
                const contact = minData?.contact;

                // Determine if there are pending actions
                const needsWeeklyConfig = !isConfigured;
                const needsContact =
                  absence?.confirmed &&
                  contact?.willContact &&
                  !contact?.contactCompleted;

                // Setup WhatsApp charge URL
                let waUrl = '';
                if (needsWeeklyConfig) {
                  const message = `Olá, *${u.username.toUpperCase()}*! Passando para lembrar de preencher o formulário de ministração da semana ${weekNumber} no aplicativo. Sua resposta ajuda no acompanhamento de toda a classe! Link do app: ${window.location.origin}`;
                  waUrl = getWhatsAppUrl(u.phone, message);
                } else if (needsContact && absence?.personName) {
                  const message = `Olá, *${u.username.toUpperCase()}*! Como está indo o contato com *${absence.personName}* que faltou à aula? Lembre-se de mandar uma mensagem para saber se está tudo bem e registrar o status no aplicativo. Um abraço!`;
                  waUrl = getWhatsAppUrl(u.phone, message);
                }

                return (
                  <article key={u.uid} className={`user-card glass ${needsWeeklyConfig || needsContact ? 'user-card--pending' : ''}`}>
                    {/* User Header */}
                    <div className="user-card__header">
                      <div className="user-card__info">
                        <h4 className="user-card__name">{u.username}</h4>
                        <span className="user-card__phone">{u.phone}</span>
                      </div>
                      
                      {isConfigured ? (
                        <span className="badge badge--success">Respondido</span>
                      ) : (
                        <span className="badge badge--danger">Pendente</span>
                      )}
                    </div>

                    {/* Ministered People Section */}
                    <div className="user-card__section">
                      <h5 className="user-card__section-title">Pessoas Ministradas:</h5>
                      {people.length > 0 ? (
                        <ul className="people-list">
                          {people.map((p) => (
                            <li key={p.id} className="people-list__item">
                              <span className="people-list__name">{p.name}</span>
                              {p.checkedInAt ? (
                                <span className="checked-in-tag" title="Confirmado">✓ Confirmado</span>
                              ) : (
                                <span className="pending-tag" title="Sem registro esta semana">Sem registro</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="user-card__empty">Nenhuma pessoa registrada.</p>
                      )}
                    </div>

                    {/* Absence Tracking Section */}
                    {isConfigured && absence?.confirmed && (
                      <div className="user-card__section user-card__section--absence highlight-warning-bg">
                        <h5 className="user-card__section-title">Falta Relatada:</h5>
                        <div className="absence-detail">
                          <p className="absence-detail__text">
                            <strong>Ausente:</strong> {absence.personName}
                          </p>
                          {contact?.willContact ? (
                            contact.contactCompleted ? (
                              <span className="contact-status contact-status--done">
                                ✓ Contato Realizado
                              </span>
                            ) : (
                              <span className="contact-status contact-status--pending">
                                ⏳ Contato Pendente
                              </span>
                            )
                          ) : (
                            <span className="contact-status contact-status--none">
                              Não fará contato voluntário
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Partner / Matches Section */}
                    <div className="user-card__section">
                      <h5 className="user-card__section-title">Dupla Ministerial:</h5>
                      {hasPartner ? (
                        <p className="user-card__text">
                          👥 <strong>{partnerName}</strong> (Confirmada)
                        </p>
                      ) : (
                        <div className="candidates-info">
                          <p className="user-card__text user-card__text--secondary">
                            🔍 Sem dupla registrada
                          </p>
                          {candidates.length > 0 ? (
                            <div className="candidates-list">
                              <span className="candidates-list__title">Candidatos sugeridos:</span>
                              <div className="candidates-list__tags">
                                {candidates.map((c, i) => (
                                  <span key={i} className="candidate-tag">{c}</span>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <p className="user-card__empty">Nenhuma sugestão enviada.</p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* WhatsApp Action Button */}
                    {waUrl && (
                      <div className="user-card__actions">
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-whatsapp"
                          title={`Cobrar via WhatsApp devido a: ${needsWeeklyConfig ? 'Preenchimento pendente' : 'Contato pendente'}`}
                        >
                          <svg className="btn-whatsapp__icon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.733-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.864-9.799.002-2.63-1.023-5.101-2.885-6.968C16.49 1.97 14.027 1.01 11.393 1.01c-5.437 0-9.863 4.373-9.868 9.803-.001 1.714.463 3.39 1.344 4.896l-.997 3.639 3.733-.969c1.472.793 2.923 1.181 4.452 1.181zM17.06 14.382c-.272-.136-1.61-.795-1.86-.886-.25-.09-.432-.136-.613.136-.182.273-.703.886-.862 1.068-.159.182-.318.205-.59.069-.272-.136-1.15-.424-2.19-1.353-.809-.722-1.354-1.615-1.513-1.888-.159-.273-.017-.42.119-.556.122-.122.272-.318.408-.477.136-.159.182-.273.272-.455.09-.182.046-.341-.023-.477-.069-.136-.613-1.477-.84-2.023-.222-.534-.488-.46-.67-.47l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.063 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.61-.659 1.838-1.264.228-.606.228-1.125.159-1.233-.068-.109-.25-.183-.522-.32z" />
                          </svg>
                          Cobrar por WhatsApp
                        </a>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="empty-state glass">
              <span className="empty-state__icon">🔍</span>
              <p className="empty-state__text">Nenhum ministrador encontrado com os filtros selecionados.</p>
              <button className="empty-state__btn" onClick={handleClearFilters}>
                Zerar Filtros
              </button>
            </div>
          )}
        </section>
      </div>

      <style jsx>{`
        .admin-dashboard {
          display: flex;
          flex-direction: column;
          gap: var(--space-6);
          width: 100%;
        }

        .admin-dashboard__header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: var(--space-4);
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          padding-bottom: var(--space-4);
        }

        .admin-dashboard__title {
          font-size: var(--font-size-xl);
          font-weight: var(--font-weight-bold);
          color: var(--color-text);
          margin: 0;
        }

        .admin-dashboard__subtitle {
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
          box-shadow: 0 0 10px rgba(59, 130, 246, 0.15);
        }

        /* Metric Cards Grid */
        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: var(--space-4);
        }

        @media (min-width: 600px) {
          .metrics-grid {
            grid-template-columns: repeat(4, 1fr);
          }
        }

        .metric-card {
          position: relative;
          display: flex;
          align-items: center;
          gap: var(--space-3);
          overflow: hidden;
        }

        .metric-card.highlight-warning {
          border: 1px solid rgba(245, 158, 11, 0.3);
        }

        .metric-card__icon {
          font-size: 1.75rem;
          line-height: 1;
        }

        .metric-card__details {
          display: flex;
          flex-direction: column;
        }

        .metric-card__value {
          font-size: var(--font-size-xl);
          font-weight: var(--font-weight-bold);
          color: var(--color-text);
          line-height: 1.1;
        }

        .metric-card__label {
          font-size: 0.6875rem;
          color: var(--color-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .metric-card__progress-bar {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: rgba(255, 255, 255, 0.05);
        }

        .metric-card__progress-fill {
          height: 100%;
          background: var(--color-primary-light);
          box-shadow: 0 0 6px var(--color-primary-light);
          transition: width var(--transition-slow);
        }

        .glass {
          background: rgba(30, 41, 59, 0.6);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: var(--radius-lg);
          padding: var(--space-4);
          box-shadow: var(--shadow-md);
        }

        /* Filter Toolbar Styling */
        .filters-section {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }

        .search-box {
          position: relative;
          width: 100%;
        }

        .search-box__icon {
          position: absolute;
          left: var(--space-3);
          top: 50%;
          transform: translateY(-50%);
          color: var(--color-text-muted);
          pointer-events: none;
        }

        .search-box__input {
          width: 100%;
          padding: var(--space-3) var(--space-3) var(--space-3) calc(var(--space-8) + var(--space-1));
          border-radius: var(--radius-md);
          background: rgba(15, 23, 42, 0.4);
          border: 1px solid var(--color-border);
          color: var(--color-text);
          transition: all var(--transition-fast);
        }

        .search-box__input:focus {
          outline: none;
          border-color: var(--color-primary-light);
          background: rgba(15, 23, 42, 0.6);
          box-shadow: var(--focus-ring);
        }

        .filter-dropdowns {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-3);
        }

        .filter-group {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          flex: 1 1 150px;
        }

        .filter-group__label {
          font-size: var(--font-size-xs);
          color: var(--color-text-muted);
          font-weight: var(--font-weight-medium);
          white-space: nowrap;
        }

        .filter-group__select {
          width: 100%;
          padding: var(--space-2) var(--space-3);
          border-radius: var(--radius-sm);
          background: rgba(15, 23, 42, 0.4);
          border: 1px solid var(--color-border);
          color: var(--color-text-secondary);
          font-size: var(--font-size-xs);
          cursor: pointer;
          transition: border-color var(--transition-fast);
        }

        .filter-group__select:focus {
          outline: none;
          border-color: var(--color-primary-light);
        }

        /* Users list and cards styling */
        .users-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }

        .users-list__header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .users-list__title {
          font-size: var(--font-size-base);
          font-weight: var(--font-weight-bold);
          color: var(--color-primary-lighter);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .users-list__grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: var(--space-4);
        }

        .user-card {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
          transition: all var(--transition-base);
        }

        .user-card:hover {
          border-color: rgba(255, 255, 255, 0.1);
        }

        .user-card--pending {
          border-left: 3px solid var(--color-warning);
        }

        .user-card__header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: var(--space-3);
        }

        .user-card__info {
          display: flex;
          flex-direction: column;
        }

        .user-card__name {
          font-size: var(--font-size-lg);
          font-weight: var(--font-weight-semibold);
          color: var(--color-text);
          text-transform: capitalize;
        }

        .user-card__phone {
          font-size: var(--font-size-xs);
          color: var(--color-text-muted);
        }

        .badge {
          display: inline-block;
          font-size: 0.6875rem;
          font-weight: var(--font-weight-semibold);
          padding: var(--space-1) var(--space-3);
          border-radius: var(--radius-pill);
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }

        .badge--success {
          background: var(--color-success-bg);
          color: var(--color-success);
          border: 1px solid rgba(34, 197, 94, 0.2);
        }

        .badge--danger {
          background: var(--color-error-bg);
          color: var(--color-error);
          border: 1px solid rgba(239, 68, 68, 0.2);
        }

        .user-card__section {
          border-top: 1px solid rgba(255, 255, 255, 0.04);
          padding-top: var(--space-3);
        }

        .user-card__section-title {
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-semibold);
          color: var(--color-text-muted);
          margin-bottom: var(--space-2);
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }

        .user-card__empty {
          font-size: var(--font-size-sm);
          color: var(--color-text-muted);
          font-style: italic;
        }

        .user-card__text {
          font-size: var(--font-size-sm);
          color: var(--color-text-secondary);
        }

        .user-card__text--secondary {
          color: var(--color-text-muted);
        }

        /* People List items */
        .people-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        .people-list__item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--space-2) var(--space-3);
          background: rgba(15, 23, 42, 0.3);
          border-radius: var(--radius-sm);
          font-size: var(--font-size-sm);
        }

        .people-list__name {
          color: var(--color-text-secondary);
          font-weight: var(--font-weight-medium);
        }

        .checked-in-tag {
          font-size: var(--font-size-xs);
          color: var(--color-success);
          font-weight: var(--font-weight-medium);
          background: rgba(34, 197, 94, 0.1);
          padding: 2px var(--space-2);
          border-radius: var(--radius-sm);
        }

        .pending-tag {
          font-size: var(--font-size-xs);
          color: var(--color-text-muted);
          background: rgba(255, 255, 255, 0.03);
          padding: 2px var(--space-2);
          border-radius: var(--radius-sm);
        }

        /* Absence Section specifics */
        .highlight-warning-bg {
          background: rgba(245, 158, 11, 0.06);
          border: 1px solid rgba(245, 158, 11, 0.15);
          border-radius: var(--radius-md);
          padding: var(--space-3) !important;
          margin-top: var(--space-1);
        }

        .absence-detail {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        .absence-detail__text {
          font-size: var(--font-size-sm);
          color: var(--color-text-secondary);
        }

        .contact-status {
          display: inline-block;
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-medium);
          padding: 2px var(--space-2);
          border-radius: var(--radius-sm);
          width: fit-content;
        }

        .contact-status--done {
          background: var(--color-success-bg);
          color: var(--color-success);
        }

        .contact-status--pending {
          background: var(--color-warning-bg);
          color: var(--color-warning);
        }

        .contact-status--none {
          background: rgba(255, 255, 255, 0.05);
          color: var(--color-text-muted);
        }

        /* Candidates suggested list */
        .candidates-info {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        .candidates-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-1);
          margin-top: 2px;
        }

        .candidates-list__title {
          font-size: 0.6875rem;
          color: var(--color-text-muted);
        }

        .candidates-list__tags {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-1);
        }

        .candidate-tag {
          font-size: var(--font-size-xs);
          color: var(--color-primary-lighter);
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.15);
          padding: 2px var(--space-2);
          border-radius: var(--radius-pill);
        }

        /* WhatsApp Button styling */
        .user-card__actions {
          border-top: 1px solid rgba(255, 255, 255, 0.04);
          padding-top: var(--space-3);
          display: flex;
          justify-content: flex-end;
        }

        .btn-whatsapp {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: var(--space-2);
          background: var(--color-success);
          color: white;
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-semibold);
          padding: var(--space-2) var(--space-4);
          border-radius: var(--radius-md);
          box-shadow: 0 4px 10px rgba(34, 197, 94, 0.2);
          transition: all var(--transition-fast);
          min-height: 38px;
        }

        .btn-whatsapp:hover {
          background: #16a34a;
          transform: translateY(-1px);
          box-shadow: 0 6px 14px rgba(34, 197, 94, 0.3);
        }

        .btn-whatsapp:active {
          transform: translateY(0);
        }

        .btn-whatsapp__icon {
          display: block;
        }

        /* Empty State Styling */
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: var(--space-10) var(--space-6);
          text-align: center;
          gap: var(--space-3);
        }

        .empty-state__icon {
          font-size: 2.5rem;
        }

        .empty-state__text {
          color: var(--color-text-secondary);
          font-size: var(--font-size-sm);
        }

        .empty-state__btn {
          background: var(--color-surface);
          color: var(--color-text);
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-medium);
          padding: var(--space-2) var(--space-4);
          border-radius: var(--radius-md);
          transition: background var(--transition-fast);
        }

        .empty-state__btn:hover {
          background: var(--color-surface-light);
        }
      `}</style>
    </AppShell>
  );
}
