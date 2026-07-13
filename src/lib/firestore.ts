// ============================================
// Firestore — User Operations & Real-time Sync
// ============================================
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  collection,
  getDocs,
  type Unsubscribe,
} from 'firebase/firestore';
import { getISOWeekDetails } from './date';
import { getFirebaseDb, isMockMode } from './firebase';
import { FIREBASE_PATHS, STORAGE_KEYS, APP_VERSION } from '@/constants';
import { getItem, setItem, removeItem } from './localStorage';
import type { UserProfile, MinistrationDocument } from '@/types';

/**
 * Find a user by username.
 * Returns the UserProfile if found, null otherwise.
 */
export async function findUserByUsername(username: string): Promise<UserProfile | null> {
  if (isMockMode()) {
    const users = getItem<Record<string, UserProfile>>('mock_firestore_users') || {};
    const norm = username.toLowerCase().trim();
    const found = Object.values(users).find((u) => u.username === norm);
    
    // Garantir que no modo Mock, se o usuário 'admin' existir, ele tenha isAdmin: true
    if (found && found.username === 'admin' && !found.isAdmin) {
      found.isAdmin = true;
      users[found.uid] = found;
      setItem('mock_firestore_users', users);
    }
    
    return found || null;
  }

  const usersRef = collection(getFirebaseDb(), FIREBASE_PATHS.USERS);
  const q = query(usersRef, where('username', '==', username.toLowerCase().trim()));
  const snapshot = await getDocs(q);

  if (snapshot.empty) return null;
  return snapshot.docs[0].data() as UserProfile;
}

/**
 * Get a user document by UID.
 */
export async function getUserById(uid: string): Promise<UserProfile | null> {
  if (isMockMode()) {
    const users = getItem<Record<string, UserProfile>>('mock_firestore_users') || {};
    const found = users[uid] || null;
    if (found && found.username === 'admin' && !found.isAdmin) {
      found.isAdmin = true;
      users[uid] = found;
      setItem('mock_firestore_users', users);
    }
    return found;
  }

  const docRef = doc(getFirebaseDb(), FIREBASE_PATHS.USERS, uid);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) return null;
  return snapshot.data() as UserProfile;
}

/**
 * Create a new user document.
 */
export async function createUser(uid: string, username: string, phone: string): Promise<UserProfile> {
  const now = Date.now();
  const normalizedUsername = username.toLowerCase().trim();
  const user: UserProfile = {
    uid,
    username: normalizedUsername,
    phone,
    createdAt: now,
    updatedAt: now,
    isAdmin: normalizedUsername === 'admin',
  };

  if (isMockMode()) {
    const users = getItem<Record<string, UserProfile>>('mock_firestore_users') || {};
    users[uid] = user;
    setItem('mock_firestore_users', users);
    return user;
  }

  await setDoc(doc(getFirebaseDb(), FIREBASE_PATHS.USERS, uid), user);
  return user;
}

/**
 * Update user fields (partial update).
 * Automatically sets updatedAt.
 */
export async function updateUser(uid: string, data: Partial<Omit<UserProfile, 'uid' | 'createdAt'>>): Promise<void> {
  if (isMockMode()) {
    const users = getItem<Record<string, UserProfile>>('mock_firestore_users') || {};
    if (users[uid]) {
      users[uid] = { ...users[uid], ...data, updatedAt: Date.now() };
      setItem('mock_firestore_users', users);
    }
    return;
  }

  const docRef = doc(getFirebaseDb(), FIREBASE_PATHS.USERS, uid);
  await updateDoc(docRef, {
    ...data,
    updatedAt: Date.now(),
  });
}

/**
 * Subscribe to real-time updates for a user document.
 * Automatically syncs to localStorage on each update.
 * Returns the unsubscribe function.
 */
export function subscribeToUser(uid: string, callback: (user: UserProfile | null) => void): Unsubscribe {
  if (isMockMode()) {
    const user = (getItem<Record<string, UserProfile>>('mock_firestore_users') || {})[uid] || null;
    callback(user);
    return () => {};
  }

  const docRef = doc(getFirebaseDb(), FIREBASE_PATHS.USERS, uid);

  return onSnapshot(docRef, (snapshot) => {
    if (snapshot.exists()) {
      const user = snapshot.data() as UserProfile;
      // Sync to localStorage
      setItem(STORAGE_KEYS.USER, user);
      callback(user);
    } else {
      callback(null);
    }
  }, (error) => {
    console.error('[Firestore] User subscription error:', error);
    callback(null);
  });
}

/**
 * Get the latest app version from Firestore config.
 */
export async function getLatestVersion(): Promise<string | null> {
  if (isMockMode()) {
    return APP_VERSION;
  }

  try {
    const docRef = doc(getFirebaseDb(), FIREBASE_PATHS.VERSION_DOC);
    const snapshot = await getDoc(docRef);
    if (!snapshot.exists()) return null;
    return snapshot.data()?.version ?? null;
  } catch (error) {
    console.warn('[Firestore] Failed to get version:', error);
    return null;
  }
}

/**
 * Subscribe to all users in real-time.
 */
export function subscribeToAllUsers(callback: (users: UserProfile[]) => void): Unsubscribe {
  if (isMockMode()) {
    const usersObj = getItem<Record<string, UserProfile>>('mock_firestore_users') || {};
    // Ensure admin user is updated in the list returned
    const list = Object.values(usersObj).map(u => {
      if (u.username === 'admin' && !u.isAdmin) {
        return { ...u, isAdmin: true };
      }
      return u;
    });
    callback(list);

    const handler = (e: StorageEvent) => {
      if (e.key === 'mock_firestore_users') {
        const updated = e.newValue ? (JSON.parse(e.newValue) as Record<string, UserProfile>) : {};
        const updatedList = Object.values(updated).map(u => {
          if (u.username === 'admin' && !u.isAdmin) {
            return { ...u, isAdmin: true };
          }
          return u;
        });
        callback(updatedList);
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }

  const usersRef = collection(getFirebaseDb(), FIREBASE_PATHS.USERS);
  const q = query(usersRef);

  return onSnapshot(q, (snapshot) => {
    const users = snapshot.docs.map((docSnap) => docSnap.data() as UserProfile);
    callback(users);
  }, (error) => {
    console.error('[Firestore] subscribeToAllUsers error:', error);
    callback([]);
  });
}

/**
 * Subscribe to a specific user's weekly ministration document in real-time.
 */
export function subscribeToUserMinistration(
  uid: string,
  weekId: string,
  callback: (data: MinistrationDocument | null) => void
): Unsubscribe {
  if (isMockMode()) {
    const cacheKey = `ministerio:ministration:${uid}:${weekId}`;
    const data = getItem<MinistrationDocument>(cacheKey);
    callback(data);

    const handler = (e: StorageEvent) => {
      if (e.key === cacheKey) {
        const updated = e.newValue ? (JSON.parse(e.newValue) as MinistrationDocument) : null;
        callback(updated);
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }

  const docRef = doc(getFirebaseDb(), FIREBASE_PATHS.USERS, uid, 'ministration', weekId);

  return onSnapshot(docRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.data() as MinistrationDocument);
    } else {
      callback(null);
    }
  }, (error) => {
    console.error(`[Firestore] subscribeToUserMinistration error for user ${uid}:`, error);
    callback(null);
  });
}

/**
 * Migrates a user profile and all their ministration subcollection documents from an old UID to a new UID.
 * This is used to maintain data persistence when an anonymous user logs in from a new device/session.
 */
export async function migrateUserUID(
  oldUid: string,
  newUid: string,
  username: string,
  phone: string
): Promise<UserProfile> {
  if (isMockMode()) {
    const users = getItem<Record<string, UserProfile>>('mock_firestore_users') || {};
    const oldUser = users[oldUid];
    const now = Date.now();
    const migratedUser: UserProfile = {
      uid: newUid,
      username: username.toLowerCase().trim(),
      phone,
      createdAt: oldUser?.createdAt ?? now,
      updatedAt: now,
      isAdmin: oldUser?.isAdmin ?? (username.toLowerCase().trim() === 'admin'),
    };
    
    // Copy profile
    users[newUid] = migratedUser;
    delete users[oldUid];
    setItem('mock_firestore_users', users);
    
    // Migrate ministration cache key
    const { weekId } = getISOWeekDetails();
    const oldCacheKey = `ministerio:ministration:${oldUid}:${weekId}`;
    const newCacheKey = `ministerio:ministration:${newUid}:${weekId}`;
    const minDoc = getItem<MinistrationDocument>(oldCacheKey);
    if (minDoc) {
      setItem(newCacheKey, minDoc);
      removeItem(oldCacheKey);
    }
    
    return migratedUser;
  }

  const db = getFirebaseDb();
  const now = Date.now();

  // 1. Get old user document to preserve creation date and admin role status
  const oldDocRef = doc(db, FIREBASE_PATHS.USERS, oldUid);
  const oldSnap = await getDoc(oldDocRef);
  let createdAt = now;
  let isAdmin = username.toLowerCase().trim() === 'admin';

  if (oldSnap.exists()) {
    const oldData = oldSnap.data() as UserProfile;
    createdAt = oldData.createdAt ?? now;
    isAdmin = oldData.isAdmin ?? isAdmin;
  }

  const newUserProfile: UserProfile = {
    uid: newUid,
    username: username.toLowerCase().trim(),
    phone,
    createdAt,
    updatedAt: now,
    isAdmin,
  };

  // 2. Create the new user profile document
  const newDocRef = doc(db, FIREBASE_PATHS.USERS, newUid);
  await setDoc(newDocRef, newUserProfile);

  // 3. Migrate all documents in the ministration subcollection
  try {
    const oldMinCollectionRef = collection(db, FIREBASE_PATHS.USERS, oldUid, 'ministration');
    const minDocsSnap = await getDocs(oldMinCollectionRef);

    for (const docSnap of minDocsSnap.docs) {
      const data = docSnap.data();
      const newMinDocRef = doc(db, FIREBASE_PATHS.USERS, newUid, 'ministration', docSnap.id);
      await setDoc(newMinDocRef, data);
      
      // Delete old min doc
      await deleteDoc(docSnap.ref);
    }
  } catch (err) {
    console.error(`[Firestore] Failed to migrate ministration subcollection for ${username}:`, err);
  }

  // 4. Delete the old user profile document
  try {
    await deleteDoc(oldDocRef);
  } catch (err) {
    console.error(`[Firestore] Failed to delete old user profile document for ${username}:`, err);
  }

  return newUserProfile;
}
