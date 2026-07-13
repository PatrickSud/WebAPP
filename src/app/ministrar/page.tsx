'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AuthGuard from '@/components/auth/AuthGuard';
import AppShell from '@/components/layout/AppShell';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useAuth } from '@/contexts/AuthContext';
import { getISOWeekDetails, getNotificationSchedules } from '@/lib/date';
import { getItem, setItem } from '@/lib/localStorage';
import { getFirebaseDb, isMockMode } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useNotificationScheduler } from '@/hooks/useNotificationScheduler';
import type { MinistrationDocument } from '@/types';

const createDefaultMinistrationDoc = (userId: string, weekId: string, weekNumber: number, year: number): MinistrationDocument => ({
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
    hasPartner: false,
    partnerName: null,
    partnerConfirmedAt: null,
    candidates: [],
  },
  people: [],
  notifications: [],
  updatedAt: Date.now(),
});

export default function MinistrarPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { requestPermission } = useNotificationScheduler();
  
  // App data states
  const [loadingData, setLoadingData] = useState(true);
  const [data, setData] = useState<MinistrationDocument | null>(null);
  const [weekDetails] = useState(() => getISOWeekDetails());
  const [isSaving, setIsSaving] = useState(false);

  // Wizard flow state
  const [step, setStep] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const stepParam = params.get('step');
      if (stepParam) {
        const stepNum = parseInt(stepParam, 10);
        if (stepNum >= 1 && stepNum <= 3) {
          return stepNum;
        }
      }
    }
    return 1;
  });

  // Step 1: Absence states
  const [absenceConfirmed, setAbsenceConfirmed] = useState<boolean | null>(null);
  const [absentName, setAbsentName] = useState('');
  const [willContact, setWillContact] = useState<boolean | null>(null);

  // Step 2: Partner states
  const [hasPartner, setHasPartner] = useState<boolean | null>(null);
  const [partnerName, setPartnerName] = useState('');
  const [candidates, setCandidates] = useState<string[]>(['', '', '']);

  // Step 3: Ministered people states
  const [ministeredPeople, setMinisteredPeople] = useState<string[]>(['']);

  // Admin phone state (for custom overrides)
  const [customAdminPhone, setCustomAdminPhone] = useState('');
  const [showPhoneConfig, setShowPhoneConfig] = useState(false);

  // Load configuration for the week
  useEffect(() => {
    if (!user) return;

    const { weekId, weekNumber, year } = getISOWeekDetails();

    const loadData = async () => {
      try {
        const cacheKey = `ministerio:ministration:${user.uid}:${weekId}`;
        const localData = getItem<MinistrationDocument>(cacheKey);

        const initializeWizardStates = (mDoc: MinistrationDocument) => {
          setAbsenceConfirmed(mDoc.absence.asked ? mDoc.absence.confirmed : null);
          setAbsentName(mDoc.absence.personName || '');
          setWillContact(mDoc.contact.willContact || null);
          setHasPartner(
            mDoc.ministry.partnerName !== null || mDoc.ministry.candidates.length > 0 
              ? mDoc.ministry.hasPartner 
              : null
          );
          setPartnerName(mDoc.ministry.partnerName || '');
          const loadedCandidates = [...mDoc.ministry.candidates];
          while (loadedCandidates.length < 3) loadedCandidates.push('');
          setCandidates(loadedCandidates);
          setMinisteredPeople(
            mDoc.people.map(p => p.name).length > 0 
              ? mDoc.people.map(p => p.name) 
              : ['']
          );
        };

        if (isMockMode()) {
          const mergedData = localData || createDefaultMinistrationDoc(user.uid, weekId, weekNumber, year);
          initializeWizardStates(mergedData);
          setData(mergedData);
          setItem(cacheKey, mergedData);
          setLoadingData(false);
          return;
        }

        const docRef = doc(getFirebaseDb(), 'users', user.uid, 'ministration', weekId);
        const docSnap = await getDoc(docRef);

        let mergedData: MinistrationDocument;

        if (docSnap.exists()) {
          const firestoreData = docSnap.data() as MinistrationDocument;
          if (localData) {
            // LWW resolution: use the one with larger updatedAt
            if (firestoreData.updatedAt >= localData.updatedAt) {
              mergedData = firestoreData;
            } else {
              mergedData = localData;
              // Upload local newer changes
              await setDoc(docRef, mergedData);
            }
          } else {
            mergedData = firestoreData;
          }
        } else {
          // Document does not exist in Firestore
          if (localData) {
            mergedData = localData;
            // Upload to Firestore
            await setDoc(docRef, mergedData);
          } else {
            // Both empty, create new
            mergedData = createDefaultMinistrationDoc(user.uid, weekId, weekNumber, year);
          }
        }

        initializeWizardStates(mergedData);
        setData(mergedData);
        setItem(cacheKey, mergedData);
      } catch (err) {
        console.error('Error loading ministration data:', err);
      } finally {
        setLoadingData(false);
      }
    };

    loadData();
  }, [user, router]);

  const saveDraft = useCallback((updatedFields: Partial<MinistrationDocument>) => {
    if (!user || !weekDetails || !data) return;
    const updatedDoc = {
      ...data,
      ...updatedFields,
      updatedAt: Date.now(),
    };
    setData(updatedDoc);
    const cacheKey = `ministerio:ministration:${user.uid}:${weekDetails.weekId}`;
    setItem(cacheKey, updatedDoc);
  }, [user, weekDetails, data]);

  // Helper validation functions
  const isStep1Valid = useCallback(() => {
    if (absenceConfirmed === null) return false;
    if (absenceConfirmed) {
      return absentName.trim().length >= 3 && willContact !== null;
    }
    return true;
  }, [absenceConfirmed, absentName, willContact]);

  const getStep2CandidatesError = useCallback(() => {
    if (hasPartner !== false) return null;
    const activeCandidates = candidates.map(c => c.trim()).filter(Boolean);
    
    if (activeCandidates.length === 0) {
      return 'Preencha pelo menos 1 candidato.';
    }
    
    const tooShort = activeCandidates.some(c => c.length < 3);
    if (tooShort) {
      return 'Cada nome de candidato deve ter pelo menos 3 caracteres.';
    }

    const uniqueSet = new Set(activeCandidates.map(c => c.toLowerCase()));
    if (uniqueSet.size !== activeCandidates.length) {
      return 'Evite nomes duplicados.';
    }

    return null;
  }, [hasPartner, candidates]);

  const isStep2Valid = useCallback(() => {
    if (hasPartner === null) return false;
    if (hasPartner) {
      return partnerName.trim().length >= 3;
    }
    return getStep2CandidatesError() === null;
  }, [hasPartner, partnerName, getStep2CandidatesError]);

  const getStep3PeopleError = () => {
    const activePeople = ministeredPeople.map(p => p.trim()).filter(Boolean);
    if (activePeople.length === 0) {
      return 'Adicione pelo menos 1 pessoa para ministrar.';
    }
    if (ministeredPeople.some(p => p.trim().length > 0 && p.trim().length < 3)) {
      return 'Cada nome deve ter pelo menos 3 caracteres.';
    }
    if (ministeredPeople.some(p => p.trim() === '')) {
      return 'Todos os campos criados devem ser preenchidos ou removidos.';
    }
    if (ministeredPeople.length > 10) {
      return 'O limite máximo é de 10 pessoas.';
    }
    return null;
  };

  const isStep3Valid = () => {
    return getStep3PeopleError() === null;
  };

  // Step 2 helper state handlers
  const handleCandidateChange = useCallback((index: number, val: string) => {
    const copy = [...candidates];
    copy[index] = val;
    setCandidates(copy);

    saveDraft({
      ministry: {
        hasPartner: !!hasPartner,
        partnerName: hasPartner ? partnerName.trim() : null,
        partnerConfirmedAt: hasPartner ? Date.now() : null,
        candidates: copy.map(c => c.trim()).filter(Boolean),
      }
    });
  }, [candidates, hasPartner, partnerName, saveDraft]);

  // Step 3 helper state handlers
  const handlePersonChange = (index: number, val: string) => {
    const copy = [...ministeredPeople];
    copy[index] = val;
    setMinisteredPeople(copy);
  };

  const handleAddPerson = () => {
    if (ministeredPeople.length < 10) {
      setMinisteredPeople(prev => [...prev, '']);
    }
  };

  const handleRemovePerson = (index: number) => {
    if (ministeredPeople.length > 1) {
      setMinisteredPeople(prev => prev.filter((_, idx) => idx !== index));
    }
  };

  const nextStep = useCallback(() => {
    if (step === 1 && isStep1Valid()) {
      let generatedNotifications: Array<{ id: string; scheduledFor: number; sent: boolean; type: 'absence_follow_up' | 'people_follow_up'; message?: string }> = [];
      if (absenceConfirmed && willContact) {
        const schedules = getNotificationSchedules(new Date(), absentName);
        generatedNotifications = schedules.map(s => ({
          id: s.id,
          scheduledFor: s.scheduledFor,
          sent: s.sent,
          type: s.type,
          message: s.message
        }));
      }

      saveDraft({
        absence: {
          asked: true,
          confirmed: !!absenceConfirmed,
          personName: absenceConfirmed ? absentName.trim() : null,
          timestamp: absenceConfirmed ? Date.now() : null,
        },
        contact: {
          willContact: !!willContact,
          confirmationTimestamp: (absenceConfirmed && willContact) ? Date.now() : null,
          contactCompleted: false,
          completedTimestamp: null,
        },
        notifications: generatedNotifications
      });
      setStep(2);
    } else if (step === 2 && isStep2Valid()) {
      saveDraft({
        ministry: {
          hasPartner: !!hasPartner,
          partnerName: hasPartner ? partnerName.trim() : null,
          partnerConfirmedAt: hasPartner ? Date.now() : null,
          candidates: !hasPartner ? candidates.map(c => c.trim()).filter(Boolean) : [],
        }
      });
      setStep(3);
    }
  }, [step, isStep1Valid, absenceConfirmed, willContact, absentName, saveDraft, isStep2Valid, hasPartner, partnerName, candidates]);

  const prevStep = () => {
    if (step > 1) setStep(step - 1);
  };

  // Finalize configuration flow
  const handleFinalize = async () => {
    if (!user || !weekDetails || !data || !isStep3Valid()) return;

    let generatedNotifications: typeof data.notifications = [];
    if (absenceConfirmed && willContact) {
      const schedules = getNotificationSchedules(new Date(), absentName);
      generatedNotifications = schedules.map(s => ({
        id: s.id,
        scheduledFor: s.scheduledFor,
        sent: s.sent,
        type: s.type,
        message: s.message
      }));
    }

    const formattedPeople = ministeredPeople
      .map(p => p.trim())
      .filter(Boolean)
      .map((name, index) => {
        const existing = data.people.find(ep => ep.name.toLowerCase() === name.toLowerCase());
        return {
          id: existing?.id || `p-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 5)}`,
          name,
          addedAt: existing?.addedAt || Date.now(),
          checkedInAt: existing?.checkedInAt || null
        };
      });

    const finalDoc: MinistrationDocument = {
      ...data,
      weekConfigured: true,
      absence: {
        asked: true,
        confirmed: !!absenceConfirmed,
        personName: absenceConfirmed ? absentName.trim() : null,
        timestamp: absenceConfirmed ? Date.now() : null,
      },
      contact: {
        willContact: !!willContact,
        confirmationTimestamp: (absenceConfirmed && willContact) ? Date.now() : null,
        contactCompleted: false,
        completedTimestamp: null,
      },
      ministry: {
        hasPartner: !!hasPartner,
        partnerName: hasPartner ? partnerName.trim() : null,
        partnerConfirmedAt: hasPartner ? Date.now() : null,
        candidates: !hasPartner ? candidates.map(c => c.trim()).filter(Boolean) : [],
      },
      people: formattedPeople,
      notifications: generatedNotifications,
      updatedAt: Date.now(),
    };

    try {
      setIsSaving(true);

      if (isMockMode()) {
        const cacheKey = `ministerio:ministration:${user.uid}:${weekDetails.weekId}`;
        setItem(cacheKey, finalDoc);
        setData(finalDoc);
        setIsSaving(false);
        // Request browser notification permission if not asked
        if (typeof window !== 'undefined' && 'Notification' in window) {
          if (Notification.permission === 'default') {
            Notification.requestPermission();
          }
        }
        return;
      }

      const docRef = doc(getFirebaseDb(), 'users', user.uid, 'ministration', weekDetails.weekId);
      await setDoc(docRef, finalDoc);

      const cacheKey = `ministerio:ministration:${user.uid}:${weekDetails.weekId}`;
      setItem(cacheKey, finalDoc);

      setData(finalDoc);
      
      // Request browser notification permission if not asked
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'default') {
          Notification.requestPermission();
        }
      }
    } catch (error) {
      console.error('Error saving weekly configuration:', error);
      alert('Erro ao salvar as configurações. Por favor, tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  // Compile WhatsApp report
  const compileReport = () => {
    if (!data || !user) return '';

    let msg = `*Relatório de Ministração Semanal*\n`;
    msg += `*Semana:* ${data.weekId}\n`;
    msg += `*Ministrador:* ${user.username}\n\n`;

    msg += `*1. Ausência na Aula:*\n`;
    if (data.absence.confirmed) {
      msg += `• Sentiu falta de: ${data.absence.personName}\n`;
      msg += `• Realizar contato: ${data.contact.willContact ? 'Sim' : 'Não'}\n`;
    } else {
      msg += `• Nenhuma ausência registrada.\n`;
    }
    msg += `\n`;

    msg += `*2. Dupla de Ministração:*\n`;
    if (data.ministry.hasPartner) {
      msg += `• Dupla: ${data.ministry.partnerName}\n`;
    } else {
      msg += `• Não tem dupla definida.\n`;
      if (data.ministry.candidates.filter(Boolean).length > 0) {
        msg += `• Candidatos sugeridos:\n`;
        data.ministry.candidates.filter(Boolean).forEach((c, idx) => {
          msg += `  ${idx + 1}. ${c}\n`;
        });
      }
    }
    msg += `\n`;

    msg += `*3. Pessoas a Ministrar:*\n`;
    if (data.people.length > 0) {
      data.people.forEach((p) => {
        msg += `• ${p.name}\n`;
      });
    } else {
      msg += `• Nenhuma pessoa listada.\n`;
    }

    return msg;
  };

  const getWhatsAppUrl = () => {
    const reportText = compileReport();
    const encodedText = encodeURIComponent(reportText);
    const adminPhone = customAdminPhone || process.env.NEXT_PUBLIC_ADMIN_PHONE || '';
    const cleanPhone = adminPhone.replace(/\D/g, '');
    
    return cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodedText}`
      : `https://api.whatsapp.com/send?text=${encodedText}`;
  };

  const handleCopyReport = () => {
    const text = compileReport();
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text)
        .then(() => alert('Relatório copiado com sucesso!'))
        .catch(() => alert('Falha ao copiar. Selecione e copie manualmente.'));
    } else {
      // Fallback
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        alert('Relatório copiado com sucesso!');
      } catch {
        alert('Falha ao copiar. Selecione e copie manualmente.');
      }
      document.body.removeChild(textArea);
    }
  };

  const handleReconfigure = () => {
    if (!data || !user || !weekDetails) return;
    const updated = {
      ...data,
      weekConfigured: false,
    };
    setData(updated);
    const cacheKey = `ministerio:ministration:${user.uid}:${weekDetails.weekId}`;
    setItem(cacheKey, updated);
    setStep(1);
  };

  if (loadingData) {
    return (
      <AuthGuard>
        <AppShell showNav={false}>
          <div className="loading-container">
            <div className="spinner" />
            <p>Carregando dados da semana…</p>
          </div>
          <style jsx>{`
            .loading-container {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 50vh;
              gap: var(--space-4);
            }
            .spinner {
              width: 40px;
              height: 40px;
              border: 4px solid var(--color-surface);
              border-top-color: var(--color-primary-light);
              border-radius: 50%;
              animation: spin 0.8s linear infinite;
            }
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </AppShell>
      </AuthGuard>
    );
  }

  const isConfigured = data?.weekConfigured;

  return (
    <AuthGuard>
      <AppShell showNav={false}>
        <div className="ministrar-container">
          
          {/* Active Wizard Flow */}
          {!isConfigured && (
            <div className="wizard-card glass animate-fade-in">
              <div className="wizard-header">
                <span className="week-badge">Semana {weekDetails?.weekId}</span>
                <h2 className="wizard-title">Configuração Semanal</h2>
                
                {/* Step indicator */}
                <div className="step-indicator">
                  <div className={`step-dot ${step >= 1 ? 'active' : ''}`} />
                  <div className={`step-line ${step >= 2 ? 'active' : ''}`} />
                  <div className={`step-dot ${step >= 2 ? 'active' : ''}`} />
                  <div className={`step-line ${step >= 3 ? 'active' : ''}`} />
                  <div className={`step-dot ${step >= 3 ? 'active' : ''}`} />
                </div>
                <div className="step-label">Etapa {step} de 3</div>
              </div>

              <div className="wizard-content">
                
                {/* STEP 1: Absence */}
                {step === 1 && (
                  <div className="step-section">
                    <h3 className="question-title">Você sentiu a falta de alguém hoje na Aula?</h3>
                    <div className="option-buttons-row">
                      <button
                        type="button"
                        className={`opt-btn ${absenceConfirmed === true ? 'selected' : ''}`}
                        onClick={() => {
                          setAbsenceConfirmed(true);
                          saveDraft({ absence: { ...data!.absence, confirmed: true, asked: true } });
                        }}
                      >
                        <span className="emoji">🙋‍♂️</span>
                        <span className="label">Sim, senti falta</span>
                      </button>
                      <button
                        type="button"
                        className={`opt-btn ${absenceConfirmed === false ? 'selected' : ''}`}
                        onClick={() => {
                          setAbsenceConfirmed(false);
                          setAbsentName('');
                          setWillContact(null);
                          saveDraft({ 
                            absence: { ...data!.absence, confirmed: false, asked: true, personName: null },
                            contact: { ...data!.contact, willContact: false }
                          });
                        }}
                      >
                        <span className="emoji">✅</span>
                        <span className="label">Não, todos presentes</span>
                      </button>
                    </div>

                    {absenceConfirmed === true && (
                      <div className="sub-question-container animate-fade-in">
                        <Input
                          label="Quem faltou?"
                          value={absentName}
                          onChange={(e) => {
                            setAbsentName(e.target.value);
                            saveDraft({ absence: { ...data!.absence, personName: e.target.value } });
                          }}
                          placeholder="Digite o nome completo"
                          error={absentName.trim().length > 0 && absentName.trim().length < 3 ? 'Mínimo de 3 caracteres.' : ''}
                        />

                        {absentName.trim().length >= 3 && (
                          <div className="contact-prompt animate-fade-in">
                            <h4 className="question-title-sub">
                              Você gostaria de realizar o contato com essa pessoa durante a semana?
                            </h4>
                            <div className="option-buttons-row-small">
                              <button
                                type="button"
                                className={`opt-btn-sm ${willContact === true ? 'selected' : ''}`}
                                onClick={() => {
                                  setWillContact(true);
                                  saveDraft({ contact: { ...data!.contact, willContact: true } });
                                  requestPermission();
                                }}
                              >
                                Sim, vou ligar/mandar mensagem
                              </button>
                              <button
                                type="button"
                                className={`opt-btn-sm ${willContact === false ? 'selected' : ''}`}
                                onClick={() => {
                                  setWillContact(false);
                                  saveDraft({ contact: { ...data!.contact, willContact: false } });
                                }}
                              >
                                Não, outra pessoa fará isso
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* STEP 2: Partner */}
                {step === 2 && (
                  <div className="step-section">
                    <h3 className="question-title">Você tem ou sabe quem é a sua dupla de ministração?</h3>
                    <div className="option-buttons-row">
                      <button
                        type="button"
                        className={`opt-btn ${hasPartner === true ? 'selected' : ''}`}
                        onClick={() => {
                          setHasPartner(true);
                          saveDraft({ ministry: { ...data!.ministry, hasPartner: true } });
                        }}
                      >
                        <span className="emoji">🤝</span>
                        <span className="label">Sim, já tenho dupla</span>
                      </button>
                      <button
                        type="button"
                        className={`opt-btn ${hasPartner === false ? 'selected' : ''}`}
                        onClick={() => {
                          setHasPartner(false);
                          setPartnerName('');
                          saveDraft({ 
                            ministry: { 
                              ...data!.ministry, 
                              hasPartner: false, 
                              partnerName: null 
                            } 
                          });
                        }}
                      >
                        <span className="emoji">🔍</span>
                        <span className="label">Não sei / Preciso de dupla</span>
                      </button>
                    </div>

                    {hasPartner === true && (
                      <div className="sub-question-container animate-fade-in">
                        <Input
                          label="Nome da sua dupla"
                          value={partnerName}
                          onChange={(e) => {
                            setPartnerName(e.target.value);
                            saveDraft({ ministry: { ...data!.ministry, partnerName: e.target.value } });
                          }}
                          placeholder="Digite o nome da sua dupla"
                          error={partnerName.trim().length > 0 && partnerName.trim().length < 3 ? 'Mínimo de 3 caracteres.' : ''}
                        />
                      </div>
                    )}

                    {hasPartner === false && (
                      <div className="sub-question-container animate-fade-in">
                        <p className="step-desc">
                          Indique até 3 nomes de candidatos sugeridos para ser sua dupla de ministração:
                        </p>
                        <div className="candidates-list">
                          {candidates.map((cand, idx) => (
                            <Input
                              key={idx}
                              label={`Candidato ${idx + 1}`}
                              value={cand}
                              onChange={(e) => handleCandidateChange(idx, e.target.value)}
                              placeholder={`Nome do candidato ${idx + 1}`}
                              error={cand.trim().length > 0 && cand.trim().length < 3 ? 'Mínimo 3 caracteres.' : ''}
                            />
                          ))}
                        </div>
                        {getStep2CandidatesError() && (
                          <p className="error-message-inline">{getStep2CandidatesError()}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* STEP 3: Ministered People */}
                {step === 3 && (
                  <div className="step-section">
                    <h3 className="question-title">Quais pessoas gostaria de estar realizando a ministração?</h3>
                    <p className="step-desc">
                      Adicione de 1 a 10 nomes de pessoas sob a sua responsabilidade ou designação.
                    </p>

                    <div className="people-inputs-container">
                      {ministeredPeople.map((person, idx) => (
                        <div key={idx} className="dynamic-input-row animate-fade-in">
                          <div className="input-flex-wrapper">
                            <Input
                              label={`Pessoa ${idx + 1}`}
                              value={person}
                              onChange={(e) => handlePersonChange(idx, e.target.value)}
                              placeholder="Nome da pessoa"
                              error={person.trim().length > 0 && person.trim().length < 3 ? 'Mínimo 3 caracteres.' : ''}
                            />
                          </div>
                          {ministeredPeople.length > 1 && (
                            <button
                              type="button"
                              className="remove-btn-large"
                              onClick={() => handleRemovePerson(idx)}
                              aria-label={`Remover pessoa ${idx + 1}`}
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    {getStep3PeopleError() && (
                      <p className="error-message-inline">{getStep3PeopleError()}</p>
                    )}

                    <div className="action-buttons-row">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={handleAddPerson}
                        disabled={ministeredPeople.length >= 10}
                        fullWidth
                      >
                        ＋ Adicionar Pessoa ({ministeredPeople.length}/10)
                      </Button>
                    </div>
                  </div>
                )}

              </div>

              <div className="wizard-footer">
                {step > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={prevStep}
                    disabled={isSaving}
                  >
                    Voltar
                  </Button>
                )}
                {step < 3 ? (
                  <Button
                    type="button"
                    onClick={nextStep}
                    disabled={step === 1 ? !isStep1Valid() : !isStep2Valid()}
                    className="next-btn-glow"
                  >
                    Continuar
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={handleFinalize}
                    disabled={!isStep3Valid() || isSaving}
                    loading={isSaving}
                    className="finalize-btn-glow"
                  >
                    Finalizar e Relatar
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Configuration Completed / Dashboard Screen */}
          {isConfigured && data && (
            <div className="dashboard-card glass animate-fade-in">
              <div className="dashboard-header">
                <span className="success-icon" aria-hidden="true">✨</span>
                <h2 className="dashboard-title">Semana Configurada!</h2>
                <p className="dashboard-desc">
                  Suas respostas foram salvas no Firestore e no cache local com sucesso.
                </p>
                <span className="week-badge-success">Semana {data.weekId}</span>
              </div>

              <div className="summary-section">
                <h3 className="section-title">Resumo da Configuração</h3>

                {/* Item 1: Absence */}
                <div className="summary-item">
                  <div className="summary-item__label">Ausência na Aula</div>
                  <div className="summary-item__value">
                    {data.absence.confirmed ? (
                      <div>
                        <span className="highlight-text">Senti falta de: {data.absence.personName}</span>
                        <div className="sub-value">
                          {data.contact.willContact 
                            ? '🔔 Contato agendado para esta semana.' 
                            : 'Ficará para outra pessoa entrar em contato.'}
                        </div>
                      </div>
                    ) : (
                      <span className="dim-text">Nenhuma ausência registrada. Todos presentes.</span>
                    )}
                  </div>
                </div>

                {/* Item 2: Partner */}
                <div className="summary-item">
                  <div className="summary-item__label">Dupla de Ministração</div>
                  <div className="summary-item__value">
                    {data.ministry.hasPartner ? (
                      <span className="highlight-text">Dupla: {data.ministry.partnerName}</span>
                    ) : (
                      <div>
                        <span className="dim-text">Sem dupla de ministração fixa nesta semana.</span>
                        {data.ministry.candidates.length > 0 && (
                          <div className="candidates-list-summary">
                            <div className="sub-label-dim">Candidatos sugeridos:</div>
                            {data.ministry.candidates.map((c, i) => (
                              <div key={i} className="candidate-badge">• {c}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Item 3: Ministered People */}
                <div className="summary-item">
                  <div className="summary-item__label">Pessoas a Ministrar ({data.people.length})</div>
                  <div className="summary-item__value">
                    <ul className="people-summary-list">
                      {data.people.map((p) => (
                        <li key={p.id} className="people-summary-item">
                          <span className="bullet">✦</span> {p.name}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              <div className="report-actions">
                <h4 className="actions-header-title">Enviar Relatório ao Administrador</h4>
                <p className="actions-desc">
                  Envie o relatório compilado para o administrador validar as sugestões de dupla e ausências.
                </p>

                <div className="whatsapp-integration-wrapper">
                  <a
                    href={getWhatsAppUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="whatsapp-btn animate-pulse"
                  >
                    <svg className="whatsapp-icon" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.262 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.739-1.45L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.864-9.799.002-2.63-1.023-5.101-2.885-6.966C16.69 1.975 14.22 1.001 11.99 1.001c-5.45 0-9.88 4.379-9.884 9.822-.001 1.778.471 3.515 1.368 5.048l-.922 3.37 3.456-.906c1.5.82 3.09 1.258 4.649 1.259zm11.385-6.881c-.247-.124-1.463-.72-1.692-.802-.228-.084-.396-.124-.562.124-.167.247-.647.802-.793.967-.146.165-.293.186-.54.062-.247-.124-1.045-.385-1.99-1.227-.736-.656-1.233-1.466-1.378-1.714-.146-.247-.016-.381.109-.504.111-.112.247-.29.37-.435.124-.145.165-.248.248-.414.084-.165.042-.31-.02-.435-.063-.124-.563-1.353-.77-1.85-.203-.491-.41-.424-.562-.431-.146-.006-.312-.007-.479-.007-.167 0-.438.062-.667.31-.229.248-.875.855-.875 2.087s.896 2.42 1.02 2.586c.124.167 1.764 2.693 4.275 3.775.597.257 1.064.411 1.428.526.6.192 1.147.165 1.579.101.481-.072 1.463-.597 1.67-.175.207-.422.207-.783 0-.907-.083-.124-.228-.186-.475-.31z"/>
                    </svg>
                    <span>Enviar via WhatsApp</span>
                  </a>

                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleCopyReport}
                    className="copy-btn-height"
                  >
                    📋 Copiar Relatório
                  </Button>
                </div>

                <div className="phone-config-container">
                  <button 
                    type="button" 
                    className="toggle-config-btn"
                    onClick={() => setShowPhoneConfig(!showPhoneConfig)}
                  >
                    {showPhoneConfig ? '✕ Fechar Configuração de Telefone' : '⚙️ Configurar Telefone do Administrador'}
                  </button>
                  
                  {showPhoneConfig && (
                    <div className="phone-input-popover animate-fade-in">
                      <Input
                        label="Telefone do Administrador"
                        value={customAdminPhone}
                        onChange={(e) => setCustomAdminPhone(e.target.value)}
                        placeholder="Ex: 5511999999999"
                        mask="phone"
                        hint="Insira com o código do país (55 para Brasil). Deixe em branco para escolher o contato no WhatsApp."
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="dashboard-footer">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleReconfigure}
                  fullWidth
                >
                  🔄 Alterar Configurações Semanais
                </Button>
              </div>
            </div>
          )}

        </div>

        <style jsx>{`
          .ministrar-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            width: 100%;
            margin-top: var(--space-4);
          }

          /* General Card Styling */
          .wizard-card, .dashboard-card {
            width: 100%;
            padding: var(--space-6) var(--space-8);
            border-radius: var(--radius-xl);
            border: 1px solid var(--color-border);
            display: flex;
            flex-direction: column;
            gap: var(--space-6);
            background: var(--color-bg-card);
            box-shadow: var(--shadow-xl);
          }

          /* Header styles */
          .wizard-header, .dashboard-header {
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            gap: var(--space-3);
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            padding-bottom: var(--space-4);
          }

          .week-badge {
            background: var(--color-primary-glow);
            color: var(--color-primary-lighter);
            padding: var(--space-1) var(--space-3);
            border-radius: var(--radius-pill);
            font-size: var(--font-size-xs);
            font-weight: var(--font-weight-semibold);
            border: 1px solid rgba(59, 130, 246, 0.3);
          }

          .week-badge-success {
            background: var(--color-success-bg);
            color: var(--color-success);
            padding: var(--space-1) var(--space-3);
            border-radius: var(--radius-pill);
            font-size: var(--font-size-xs);
            font-weight: var(--font-weight-semibold);
            border: 1px solid rgba(34, 197, 94, 0.3);
          }

          .wizard-title, .dashboard-title {
            font-size: var(--font-size-xl);
            font-weight: var(--font-weight-bold);
            color: var(--color-text);
            margin: 0;
          }

          .dashboard-desc {
            font-size: var(--font-size-base);
            color: var(--color-text-secondary);
            margin: 0;
            max-width: 480px;
          }

          /* Progress Indicator */
          .step-indicator {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 160px;
            margin: var(--space-2) 0;
          }

          .step-dot {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: var(--color-surface);
            transition: all var(--transition-base);
          }

          .step-dot.active {
            background: var(--color-primary-light);
            box-shadow: 0 0 10px var(--color-primary-light);
          }

          .step-line {
            flex: 1;
            height: 2px;
            background: var(--color-surface);
            transition: all var(--transition-base);
          }

          .step-line.active {
            background: var(--color-primary-light);
          }

          .step-label {
            font-size: var(--font-size-xs);
            color: var(--color-text-muted);
            font-weight: var(--font-weight-medium);
          }

          /* Wizard content sections */
          .wizard-content {
            min-height: 240px;
            display: flex;
            flex-direction: column;
            justify-content: center;
          }

          .step-section {
            display: flex;
            flex-direction: column;
            gap: var(--space-5);
            width: 100%;
          }

          .question-title {
            font-size: var(--font-size-lg);
            font-weight: var(--font-weight-semibold);
            color: var(--color-text);
            text-align: center;
            line-height: var(--line-height-normal);
            margin: 0;
          }

          .question-title-sub {
            font-size: var(--font-size-base);
            font-weight: var(--font-weight-semibold);
            color: var(--color-text);
            line-height: var(--line-height-normal);
            margin: 0 0 var(--space-3) 0;
          }

          .step-desc {
            font-size: var(--font-size-sm);
            color: var(--color-text-muted);
            margin: 0;
          }

          /* Option Buttons */
          .option-buttons-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: var(--space-4);
            width: 100%;
          }

          .opt-btn {
            background: var(--color-bg-card-hover);
            border: 1.5px solid var(--color-border);
            border-radius: var(--radius-lg);
            padding: var(--space-5) var(--space-3);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: var(--space-2);
            cursor: pointer;
            transition: all var(--transition-spring);
            min-height: 80px;
          }

          .opt-btn:hover {
            border-color: var(--color-border-light);
            background: var(--color-surface);
            transform: translateY(-2px);
          }

          .opt-btn.selected {
            background: var(--color-primary-glow);
            border-color: var(--color-primary-light);
            box-shadow: var(--shadow-glow);
          }

          .opt-btn .emoji {
            font-size: var(--font-size-2xl);
            line-height: 1;
          }

          .opt-btn .label {
            font-size: var(--font-size-base);
            font-weight: var(--font-weight-semibold);
            color: var(--color-text);
          }

          .option-buttons-row-small {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: var(--space-3);
            width: 100%;
          }

          .opt-btn-sm {
            background: var(--color-bg);
            border: 1.5px solid var(--color-border);
            border-radius: var(--radius-md);
            padding: var(--space-3) var(--space-4);
            font-size: var(--font-size-sm);
            font-weight: var(--font-weight-medium);
            color: var(--color-text-secondary);
            cursor: pointer;
            transition: all var(--transition-fast);
            min-height: 48px;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
          }

          .opt-btn-sm:hover {
            border-color: var(--color-border-light);
            background: var(--color-bg-card-hover);
          }

          .opt-btn-sm.selected {
            background: var(--color-primary-glow);
            border-color: var(--color-primary-light);
            color: white;
          }

          /* Dynamic list of inputs */
          .sub-question-container {
            display: flex;
            flex-direction: column;
            gap: var(--space-4);
            padding-top: var(--space-4);
            border-top: 1px solid rgba(255, 255, 255, 0.05);
          }

          .contact-prompt {
            padding: var(--space-4);
            background: rgba(15, 23, 42, 0.3);
            border-radius: var(--radius-md);
            border: 1px solid var(--color-border);
            display: flex;
            flex-direction: column;
            gap: var(--space-2);
          }

          .candidates-list, .people-inputs-container {
            display: flex;
            flex-direction: column;
            gap: var(--space-3);
          }

          .dynamic-input-row {
            display: flex;
            align-items: flex-end;
            gap: var(--space-2);
            width: 100%;
          }

          .input-flex-wrapper {
            flex: 1;
          }

          .remove-btn-large {
            background: transparent;
            color: var(--color-text-muted);
            border: none;
            cursor: pointer;
            padding: var(--space-2);
            font-size: var(--font-size-lg);
            transition: color var(--transition-fast);
            min-height: 48px;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .remove-btn-large:hover {
            color: var(--color-error);
          }

          .error-message-inline {
            font-size: var(--font-size-xs);
            color: var(--color-error);
            margin: 0;
          }

          /* Footer buttons */
          .wizard-footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-top: 1px solid rgba(255, 255, 255, 0.05);
            padding-top: var(--space-4);
            gap: var(--space-4);
          }

          .wizard-footer :global(.btn) {
            flex: 1;
          }

          .next-btn-glow {
            box-shadow: 0 0 15px rgba(59, 130, 246, 0.4);
          }

          .finalize-btn-glow {
            box-shadow: 0 0 15px rgba(59, 130, 246, 0.5);
          }

          /* Summary Dashboard Styling */
          .success-icon {
            font-size: 3rem;
            line-height: 1;
            animation: bounce 1.5s ease infinite;
          }

          .summary-section {
            display: flex;
            flex-direction: column;
            gap: var(--space-4);
            background: rgba(15, 23, 42, 0.2);
            padding: var(--space-5);
            border-radius: var(--radius-lg);
            border: 1px solid var(--color-border);
          }

          .section-title {
            font-size: var(--font-size-base);
            font-weight: var(--font-weight-bold);
            color: var(--color-primary-lighter);
            margin: 0;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }

          .summary-item {
            display: flex;
            flex-direction: column;
            gap: var(--space-1);
            padding-bottom: var(--space-3);
            border-bottom: 1px solid rgba(255, 255, 255, 0.03);
          }

          .summary-item:last-child {
            border-bottom: none;
            padding-bottom: 0;
          }

          .summary-item__label {
            font-size: var(--font-size-xs);
            font-weight: var(--font-weight-semibold);
            color: var(--color-text-muted);
          }

          .summary-item__value {
            font-size: var(--font-size-base);
            color: var(--color-text);
          }

          .highlight-text {
            color: white;
            font-weight: var(--font-weight-medium);
          }

          .dim-text {
            color: var(--color-text-muted);
            font-style: italic;
          }

          .sub-value {
            font-size: var(--font-size-xs);
            color: var(--color-text-secondary);
            margin-top: 2px;
          }

          .candidates-list-summary {
            display: flex;
            flex-direction: column;
            gap: var(--space-1);
            margin-top: var(--space-2);
          }

          .sub-label-dim {
            font-size: var(--font-size-xs);
            color: var(--color-text-muted);
          }

          .candidate-badge {
            font-size: var(--font-size-sm);
            color: var(--color-text-secondary);
            padding-left: var(--space-2);
          }

          .people-summary-list {
            display: flex;
            flex-direction: column;
            gap: var(--space-1);
            margin-top: var(--space-2);
          }

          .people-summary-item {
            display: flex;
            align-items: center;
            gap: var(--space-2);
            font-size: var(--font-size-sm);
            color: var(--color-text-secondary);
          }

          .people-summary-item .bullet {
            color: var(--color-primary-light);
            font-size: 10px;
          }

          /* Dashboard Report Actions */
          .report-actions {
            border-top: 1px solid rgba(255, 255, 255, 0.05);
            padding-top: var(--space-5);
            display: flex;
            flex-direction: column;
            gap: var(--space-4);
          }

          .actions-header-title {
            font-size: var(--font-size-base);
            font-weight: var(--font-weight-semibold);
            color: white;
            margin: 0;
          }

          .actions-desc {
            font-size: var(--font-size-xs);
            color: var(--color-text-muted);
            margin: 0;
          }

          .whatsapp-integration-wrapper {
            display: flex;
            flex-direction: column;
            gap: var(--space-3);
          }

          .whatsapp-btn {
            background: #25D366;
            color: white;
            font-weight: var(--font-weight-bold);
            font-size: var(--font-size-base);
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: var(--space-2);
            border-radius: var(--radius-md);
            cursor: pointer;
            transition: all var(--transition-base);
            min-height: 48px;
            width: 100%;
            box-shadow: 0 4px 10px rgba(37, 211, 102, 0.3);
          }

          .whatsapp-btn:hover {
            background: #128C7E;
            transform: scale(1.02);
            box-shadow: 0 6px 15px rgba(37, 211, 102, 0.4);
          }

          .whatsapp-btn:active {
            transform: scale(0.98);
          }

          .whatsapp-icon {
            flex-shrink: 0;
          }

          .copy-btn-height {
            min-height: 48px;
          }

          .phone-config-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: var(--space-2);
            margin-top: var(--space-2);
          }

          .toggle-config-btn {
            font-size: var(--font-size-xs);
            color: var(--color-text-muted);
            background: transparent;
            border: none;
            cursor: pointer;
            transition: color var(--transition-fast);
            min-height: 36px;
          }

          .toggle-config-btn:hover {
            color: var(--color-text);
          }

          .phone-input-popover {
            width: 100%;
            background: rgba(15, 23, 42, 0.4);
            padding: var(--space-4);
            border-radius: var(--radius-md);
            border: 1px solid var(--color-border);
          }

          .dashboard-footer {
            border-top: 1px solid rgba(255, 255, 255, 0.05);
            padding-top: var(--space-4);
          }

          /* Animations */
          .animate-fade-in {
            animation: fadeIn 0.4s ease-out both;
          }

          .animate-pulse {
            animation: pulse-effect 2s infinite;
          }

          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(12px); }
            to { opacity: 1; transform: translateY(0); }
          }

          @keyframes pulse-effect {
            0%, 100% { box-shadow: 0 4px 10px rgba(37, 211, 102, 0.3); }
            50% { box-shadow: 0 4px 20px rgba(37, 211, 102, 0.6); }
          }

          @keyframes bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-8px); }
          }

          @media (max-width: 480px) {
            .wizard-card, .dashboard-card {
              padding: var(--space-4) var(--space-5);
            }
            .option-buttons-row {
              grid-template-columns: 1fr;
              gap: var(--space-3);
            }
            .option-buttons-row-small {
              grid-template-columns: 1fr;
            }
          }
        `}</style>

      </AppShell>
    </AuthGuard>
  );
}
