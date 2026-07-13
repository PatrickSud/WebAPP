// ============================================
// Ministério App — Global Types
// ============================================

/** User document stored in Firestore /users/{uid} */
export interface UserProfile {
  uid: string;
  username: string;
  phone: string;
  createdAt: number;   // Unix timestamp ms
  updatedAt: number;   // Unix timestamp ms
  isAdmin?: boolean;   // Opcional para definir privilégios de administração
}

/** Weekly ministration configuration and status document */
export interface MinistrationDocument {
  weekId: string;
  weekNumber: number;
  year: number;
  weekConfigured: boolean;
  
  absence: {
    asked: boolean;
    confirmed: boolean;
    personName: string | null;
    timestamp: number | null;
  };
  
  contact: {
    willContact: boolean;
    confirmationTimestamp: number | null;
    contactCompleted: boolean;
    completedTimestamp: number | null;
  };
  
  ministry: {
    hasPartner: boolean;
    partnerName: string | null;
    partnerConfirmedAt: number | null;
    candidates: string[];
  };
  
  people: Array<{
    id: string;
    name: string;
    addedAt: number;
    checkedInAt: number | null;
  }>;
  
  notifications: Array<{
    id: string;
    scheduledFor: number;
    sent: boolean;
    type: 'absence_follow_up' | 'people_follow_up';
    message?: string;
  }>;
  
  updatedAt: number;
}

/** Authentication state */
export interface AuthState {
  user: UserProfile | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
}

/** Session data stored in RTDB /sessions/{uid} */
export interface SessionData {
  uid: string;
  username: string;
  lastActive: number;
  online: boolean;
  appVersion: string;
}

/** App version info */
export interface AppVersion {
  current: string;
  latest: string;
  hasUpdate: boolean;
}

/** Navigation item */
export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
}

/** Firebase config shape */
export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  databaseURL: string;
}

/** Local storage cache entry */
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  version: string;
}
