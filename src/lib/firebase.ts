// ============================================
// Firebase — Initialization & Config (Lazy)
// ============================================
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getDatabase, type Database } from 'firebase/database';

const firebaseConfig = {
  apiKey: (process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '').trim(),
  authDomain: (process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '').trim(),
  projectId: (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '').trim(),
  storageBucket: (process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '').trim(),
  messagingSenderId: (process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '').trim(),
  appId: (process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '').trim(),
  databaseURL: (process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || '').trim(),
};

export function isMockMode(): boolean {
  if (typeof window === 'undefined') return false;
  const searchParams = new URLSearchParams(window.location.search);
  const apiKey = (process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '').trim();
  return (
    searchParams.get('mock') === 'true' ||
    !apiKey ||
    apiKey === 'your-api-key-here'
  );
}

if (typeof window !== 'undefined') {
  console.log('[Firebase config]', {
    apiKeyLength: firebaseConfig.apiKey.length,
    projectId: firebaseConfig.projectId,
    isMockMode: isMockMode(),
  });
}

/**
 * Lazy singleton: only initialize Firebase when actually needed (client-side).
 * This prevents build-time errors from missing API keys during SSR/prerendering.
 */
let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;
let _rtdb: Database | null = null;

function getFirebaseApp(): FirebaseApp {
  if (isMockMode()) {
    return {} as FirebaseApp;
  }
  if (!_app) {
    _app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  }
  return _app;
}

export function getFirebaseAuth(): Auth {
  if (isMockMode()) {
    return {} as Auth;
  }
  if (!_auth) {
    _auth = getAuth(getFirebaseApp());
  }
  return _auth;
}

export function getFirebaseDb(): Firestore {
  if (isMockMode()) {
    return {} as Firestore;
  }
  if (!_db) {
    _db = getFirestore(getFirebaseApp());
  }
  return _db;
}

export function getFirebaseRtdb(): Database {
  if (isMockMode()) {
    return {} as Database;
  }
  if (!_rtdb) {
    _rtdb = getDatabase(getFirebaseApp());
  }
  return _rtdb;
}

export default getFirebaseApp;
