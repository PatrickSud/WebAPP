// ============================================
// Local Storage — Safe Utilities with Namespace
// ============================================
import type { CacheEntry } from '@/types';
import { APP_VERSION } from '@/constants';

/**
 * Check if localStorage is available (handles SSR & private browsing).
 */
function isAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const testKey = '__localStorage_test__';
    window.localStorage.setItem(testKey, 'test');
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get a parsed value from localStorage.
 * Returns null if not found, expired, or unparseable.
 */
export function getItem<T>(key: string): T | null {
  if (!isAvailable()) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    return entry.data;
  } catch {
    return null;
  }
}

/**
 * Set a value in localStorage wrapped with metadata.
 */
export function setItem<T>(key: string, data: T): void {
  if (!isAvailable()) return;
  try {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      version: APP_VERSION,
    };
    window.localStorage.setItem(key, JSON.stringify(entry));
  } catch (error) {
    // Quota exceeded or other storage error
    console.warn('[localStorage] Failed to set item:', key, error);
  }
}

/**
 * Remove a value from localStorage.
 */
export function removeItem(key: string): void {
  if (!isAvailable()) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Silently fail
  }
}

/**
 * Get the timestamp of when a key was last written.
 */
export function getTimestamp(key: string): number | null {
  if (!isAvailable()) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry<unknown>;
    return entry.timestamp ?? null;
  } catch {
    return null;
  }
}

/**
 * Clear all namespaced keys (ministerio:*).
 */
export function clearAll(): void {
  if (!isAvailable()) return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key?.startsWith('ministerio:')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    // Silently fail
  }
}
