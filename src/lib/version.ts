// ============================================
// Version — Check & Compare
// ============================================
import { APP_VERSION } from '@/constants';
import { getLatestVersion } from './firestore';
import type { AppVersion } from '@/types';

/**
 * Compare semantic version strings.
 * Returns: -1 if a < b, 0 if equal, 1 if a > b
 */
function compareSemver(a: string, b: string): number {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);
  const len = Math.max(partsA.length, partsB.length);

  for (let i = 0; i < len; i++) {
    const numA = partsA[i] || 0;
    const numB = partsB[i] || 0;
    if (numA < numB) return -1;
    if (numA > numB) return 1;
  }
  return 0;
}

/**
 * Check if a new version is available by comparing
 * the local app version with the latest in Firestore.
 */
export async function checkForUpdate(): Promise<AppVersion> {
  const latest = await getLatestVersion();

  if (!latest) {
    return {
      current: APP_VERSION,
      latest: APP_VERSION,
      hasUpdate: false,
    };
  }

  return {
    current: APP_VERSION,
    latest,
    hasUpdate: compareSemver(APP_VERSION, latest) < 0,
  };
}

/**
 * Force the service worker to skip waiting and activate,
 * then clear old caches and reload.
 */
export async function applyUpdate(): Promise<void> {
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  }

  // Clear all caches
  if ('caches' in window) {
    const names = await caches.keys();
    await Promise.all(names.map((name) => caches.delete(name)));
  }

  // Hard reload
  window.location.reload();
}
