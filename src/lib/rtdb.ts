// ============================================
// Realtime Database — Session Management
// ============================================
import {
  ref,
  set,
  update,
  onValue,
  onDisconnect,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/database';
import { getFirebaseRtdb, isMockMode } from './firebase';
import { FIREBASE_PATHS } from '@/constants';
import { APP_VERSION } from '@/constants';
import { getItem, setItem } from './localStorage';
import type { SessionData } from '@/types';

/**
 * Create or update a session in RTDB.
 */
export async function setSession(uid: string, username: string): Promise<void> {
  if (isMockMode()) {
    const session: SessionData = {
      uid,
      username,
      lastActive: Date.now(),
      online: true,
      appVersion: APP_VERSION,
    };
    setItem(`mock_rtdb_session:${uid}`, session);
    return;
  }

  const sessionRef = ref(getFirebaseRtdb(), `${FIREBASE_PATHS.SESSIONS}/${uid}`);

  const session: SessionData = {
    uid,
    username,
    lastActive: Date.now(),
    online: true,
    appVersion: APP_VERSION,
  };

  await set(sessionRef, session);

  // Set up automatic cleanup on disconnect
  const onlineRef = ref(getFirebaseRtdb(), `${FIREBASE_PATHS.SESSIONS}/${uid}/online`);
  const lastActiveRef = ref(getFirebaseRtdb(), `${FIREBASE_PATHS.SESSIONS}/${uid}/lastActive`);
  
  onDisconnect(onlineRef).set(false);
  onDisconnect(lastActiveRef).set(serverTimestamp());
}

/**
 * Update the lastActive timestamp (heartbeat).
 */
export async function updateLastActive(uid: string): Promise<void> {
  if (isMockMode()) {
    const session = getItem<SessionData>(`mock_rtdb_session:${uid}`);
    if (session) {
      session.lastActive = Date.now();
      session.online = true;
      setItem(`mock_rtdb_session:${uid}`, session);
    }
    return;
  }

  const sessionRef = ref(getFirebaseRtdb(), `${FIREBASE_PATHS.SESSIONS}/${uid}`);
  await update(sessionRef, {
    lastActive: Date.now(),
    online: true,
  });
}

/**
 * Remove session on logout.
 */
export async function removeSession(uid: string): Promise<void> {
  if (isMockMode()) {
    const session = getItem<SessionData>(`mock_rtdb_session:${uid}`);
    if (session) {
      session.online = false;
      session.lastActive = Date.now();
      setItem(`mock_rtdb_session:${uid}`, session);
    }
    return;
  }

  const sessionRef = ref(getFirebaseRtdb(), `${FIREBASE_PATHS.SESSIONS}/${uid}`);
  await update(sessionRef, {
    online: false,
    lastActive: Date.now(),
  });
}

/**
 * Subscribe to session changes for a user.
 */
export function subscribeToSession(uid: string, callback: (session: SessionData | null) => void): Unsubscribe {
  if (isMockMode()) {
    const session = getItem<SessionData>(`mock_rtdb_session:${uid}`);
    callback(session);
    return () => {};
  }

  const sessionRef = ref(getFirebaseRtdb(), `${FIREBASE_PATHS.SESSIONS}/${uid}`);

  return onValue(sessionRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.val() as SessionData);
    } else {
      callback(null);
    }
  }, (error) => {
    console.error('[RTDB] Session subscription error:', error);
    callback(null);
  });
}
