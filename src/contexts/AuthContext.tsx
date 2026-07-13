'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { signInAnonymously, onAuthStateChanged, signOut, type User as FirebaseUser } from 'firebase/auth';
import { getFirebaseAuth, isMockMode } from '@/lib/firebase';
import { findUserByUsername, createUser, subscribeToUser } from '@/lib/firestore';
import { setSession, removeSession } from '@/lib/rtdb';
import { getItem, setItem, removeItem, clearAll } from '@/lib/localStorage';
import { STORAGE_KEYS } from '@/constants';
import { unmaskPhone } from '@/components/ui/Input';
import type { UserProfile, AuthState } from '@/types';

// ============================================
// Auth Context
// ============================================

interface AuthContextValue extends AuthState {
  login: (username: string, phone: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    // Try to restore from localStorage on first render
    if (typeof window !== 'undefined') {
      const cached = getItem<UserProfile>(STORAGE_KEYS.USER);
      if (cached) {
        return {
          user: cached,
          loading: true,
          error: null,
          isAuthenticated: true,
        };
      }
    }
    return {
      user: null,
      loading: true,
      error: null,
      isAuthenticated: false,
    };
  });

  const unsubUserRef = useRef<(() => void) | null>(null);

  // Listen to Firebase Auth state
  useEffect(() => {
    if (isMockMode()) {
      const cached = getItem<UserProfile>(STORAGE_KEYS.USER);
      const timer = setTimeout(() => {
        if (cached) {
          setState({
            user: cached,
            loading: false,
            error: null,
            isAuthenticated: true,
          });
        } else {
          setState({
            user: null,
            loading: false,
            error: null,
            isAuthenticated: false,
          });
        }
      }, 0);
      return () => clearTimeout(timer);
    }

    const unsubAuth = onAuthStateChanged(getFirebaseAuth(), async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser && state.user) {
        // Already have local user data, subscribe to updates
        unsubUserRef.current?.();
        unsubUserRef.current = subscribeToUser(firebaseUser.uid, (updatedUser) => {
          if (updatedUser) {
            setState((prev) => ({
              ...prev,
              user: updatedUser,
              isAuthenticated: true,
              loading: false,
            }));
          }
        });
      } else if (!firebaseUser) {
        // Signed out
        unsubUserRef.current?.();
        unsubUserRef.current = null;

        const cached = getItem<UserProfile>(STORAGE_KEYS.USER);
        if (!cached) {
          setState({
            user: null,
            loading: false,
            error: null,
            isAuthenticated: false,
          });
        } else {
          setState((prev) => ({ ...prev, loading: false }));
        }
      } else {
        setState((prev) => ({ ...prev, loading: false }));
      }
    });

    return () => {
      unsubAuth();
      unsubUserRef.current?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Login flow:
   * 1. Check if user exists in Firestore by username
   * 2. If found, validate phone matches
   * 3. If not found, create new user (signup implicit)
   * 4. Sign in anonymously to Firebase Auth for session management
   * 5. Create RTDB session
   */
  const login = useCallback(async (username: string, phone: string) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const rawPhone = unmaskPhone(phone);
      const normalizedUsername = username.toLowerCase().trim();

      if (!normalizedUsername || normalizedUsername.length < 3) {
        throw new Error('Nome de usuário deve ter pelo menos 3 caracteres.');
      }

      if (!rawPhone || rawPhone.length < 10 || rawPhone.length > 11) {
        throw new Error('Telefone inválido. Use o formato (XX) XXXXX-XXXX.');
      }

      if (isMockMode()) {
        const uid = 'mock-user-id-' + Math.random().toString(36).substring(2, 9);
        let userProfile: UserProfile;

        const existingUser = await findUserByUsername(normalizedUsername);

        if (existingUser) {
          // Validate phone matches
          if (unmaskPhone(existingUser.phone) !== rawPhone) {
            throw new Error('Telefone não corresponde ao usuário cadastrado.');
          }
          userProfile = existingUser;
        } else {
          // Create new user
          userProfile = await createUser(uid, normalizedUsername, phone);
        }

        // Create session in RTDB
        await setSession(uid, normalizedUsername);

        // Cache locally
        setItem(STORAGE_KEYS.USER, userProfile);

        setState({
          user: userProfile,
          loading: false,
          error: null,
          isAuthenticated: true,
        });
        return;
      }

      // Check if user exists
      const existingUser = await findUserByUsername(normalizedUsername);

      if (existingUser) {
        // Validate phone matches
        if (unmaskPhone(existingUser.phone) !== rawPhone) {
          throw new Error('Telefone não corresponde ao usuário cadastrado.');
        }
      }

      // Sign in anonymously to get a Firebase UID
      const credential = await signInAnonymously(getFirebaseAuth());
      const uid = credential.user.uid;

      let userProfile: UserProfile;

      if (existingUser) {
        userProfile = existingUser;
      } else {
        // Create new user
        userProfile = await createUser(uid, normalizedUsername, phone);
      }

      // Create session in RTDB
      await setSession(uid, normalizedUsername);

      // Cache locally
      setItem(STORAGE_KEYS.USER, userProfile);

      // Subscribe to real-time updates
      unsubUserRef.current?.();
      unsubUserRef.current = subscribeToUser(uid, (updated) => {
        if (updated) {
          setState((prev) => ({ ...prev, user: updated }));
        }
      });

      setState({
        user: userProfile,
        loading: false,
        error: null,
        isAuthenticated: true,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao fazer login. Tente novamente.';
      setState((prev) => ({
        ...prev,
        loading: false,
        error: message,
      }));
      throw error;
    }
  }, []);

  /**
   * Logout: sign out of Firebase, clear local data, remove session.
   */
  const logout = useCallback(async () => {
    try {
      if (isMockMode()) {
        const cached = getItem<UserProfile>(STORAGE_KEYS.USER);
        if (cached) {
          await removeSession(cached.uid);
        }
        removeItem(STORAGE_KEYS.USER);
        removeItem(STORAGE_KEYS.SESSION);
        clearAll();

        setState({
          user: null,
          loading: false,
          error: null,
          isAuthenticated: false,
        });
        return;
      }

      const uid = getFirebaseAuth().currentUser?.uid;

      // Unsubscribe from updates
      unsubUserRef.current?.();
      unsubUserRef.current = null;

      // Remove RTDB session
      if (uid) {
        await removeSession(uid);
      }

      // Sign out Firebase
      await signOut(getFirebaseAuth());

      // Clear local storage
      removeItem(STORAGE_KEYS.USER);
      removeItem(STORAGE_KEYS.SESSION);
      clearAll();

      setState({
        user: null,
        loading: false,
        error: null,
        isAuthenticated: false,
      });
    } catch (error) {
      console.error('[Auth] Logout error:', error);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access auth context. Must be used within AuthProvider.
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
