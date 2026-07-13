// ============================================
// Ministério App — Constants
// ============================================

/** App version from package.json (injected via next.config.ts) */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || '0.1.0';

/** Route paths */
export const ROUTES = {
  HOME: '/home',
  LOGIN: '/login',
  MINISTRAR: '/ministrar',
  ADMIN: '/admin',
} as const;

/** Local Storage keys (namespaced to avoid collisions) */
export const STORAGE_KEYS = {
  USER: 'ministerio:user',
  SESSION: 'ministerio:session',
  VERSION: 'ministerio:version',
  AUTH_TOKEN: 'ministerio:auth',
} as const;

/** Firebase collection/path names */
export const FIREBASE_PATHS = {
  USERS: 'users',
  CONFIG: 'config',
  VERSION_DOC: 'config/version',
  SESSIONS: 'sessions',
} as const;

/** Phone mask for Brazilian numbers */
export const PHONE_MASK = {
  pattern: '(XX) XXXXX-XXXX',
  maxLength: 15,
  regex: /^\(\d{2}\)\s\d{5}-\d{4}$/,
  rawRegex: /^\d{10,11}$/,
} as const;

/** Navigation items config */
export const NAV_ITEMS = [
  {
    id: 'ministrar',
    label: 'Ministrar',
    href: ROUTES.MINISTRAR,
  },
  {
    id: 'home',
    label: 'Início',
    href: ROUTES.HOME,
  },
] as const;
