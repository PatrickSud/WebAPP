'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getISOWeekDetails } from '@/lib/date';
import { getFirebaseDb, isMockMode } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { getItem, setItem } from '@/lib/localStorage';
import type { MinistrationDocument } from '@/types';

// ============================================
// Types
// ============================================

// ============================================
// Helper to post messages to the Service Worker
// ============================================
function syncNotificationsWithSW(data: MinistrationDocument) {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  navigator.serviceWorker.ready.then((registration) => {
    const worker = navigator.serviceWorker.controller || registration.active;
    if (!worker) {
      console.warn('[NotificationScheduler] Service Worker active instance not found.');
      return;
    }

    const { absence, contact, notifications } = data;
    const isContactCompleted = contact?.contactCompleted;
    const willContactPerson = absence?.confirmed && contact?.willContact;

    if (isContactCompleted || !willContactPerson) {
      worker.postMessage({
        type: 'CLEAR_NOTIFICATIONS'
      });
      console.log('[NotificationScheduler] Requested CLEAR_NOTIFICATIONS to SW');
    } else {
      worker.postMessage({
        type: 'SCHEDULE_NOTIFICATIONS',
        notifications: notifications || []
      });
      console.log('[NotificationScheduler] Requested SCHEDULE_NOTIFICATIONS to SW:', notifications?.length);
    }
  }).catch((err) => {
    console.error('[NotificationScheduler] Error checking Service Worker ready state:', err);
  });
}

// ============================================
// useNotificationScheduler Custom Hook
// ============================================
export function useNotificationScheduler() {
  const { user } = useAuth();
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'default';
  });

  // Request browser notification permission
  const requestPermission = async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      console.warn('[NotificationScheduler] Native notifications are not supported by this browser.');
      return false;
    }

    if (Notification.permission === 'granted') {
      setPermissionStatus('granted');
      return true;
    }

    if (Notification.permission === 'denied') {
      console.warn('[NotificationScheduler] Notification permission has been denied by the user.');
      setPermissionStatus('denied');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      setPermissionStatus(permission);
      return permission === 'granted';
    } catch (err) {
      console.error('[NotificationScheduler] Error requesting notification permission:', err);
      return false;
    }
  };

  // Real-time synchronization effect
  useEffect(() => {
    if (!user) return;

    const { weekId } = getISOWeekDetails();
    const cacheKey = `ministerio:ministration:${user.uid}:${weekId}`;

    const handleDataUpdate = (data: MinistrationDocument) => {
      syncNotificationsWithSW(data);
    };

    if (isMockMode()) {
      console.log('[NotificationScheduler] Initializing in Mock Mode for week:', weekId);
      
      // Load initial cached data
      const initialData = getItem<MinistrationDocument>(cacheKey);
      if (initialData) {
        handleDataUpdate(initialData);
      }

      // Sync across tabs/windows in Mock Mode using the local storage event
      const handleStorageChange = (e: StorageEvent) => {
        if (e.key === cacheKey && e.newValue) {
          try {
            const parsed = JSON.parse(e.newValue) as MinistrationDocument;
            handleDataUpdate(parsed);
          } catch (err) {
            console.error('[NotificationScheduler] Mock storage parse error:', err);
          }
        }
      };

      window.addEventListener('storage', handleStorageChange);
      
      // Also poll local storage for this tab's own writes
      const interval = setInterval(() => {
        const currentData = getItem<MinistrationDocument>(cacheKey);
        if (currentData) {
          handleDataUpdate(currentData);
        }
      }, 5000);

      return () => {
        window.removeEventListener('storage', handleStorageChange);
        clearInterval(interval);
      };
    } else {
      console.log('[NotificationScheduler] Initializing Firestore Listener for week:', weekId);
      const docRef = doc(getFirebaseDb(), 'users', user.uid, 'ministration', weekId);

      const unsubscribe = onSnapshot(
        docRef,
        (docSnap) => {
          if (docSnap.exists()) {
            const firestoreData = docSnap.data() as MinistrationDocument;
            // Update Local Storage
            setItem(cacheKey, firestoreData);
            // Sincroniza com o Service Worker
            handleDataUpdate(firestoreData);
          }
        },
        (error) => {
          console.error('[NotificationScheduler] Firestore real-time listener error:', error);
        }
      );

      return () => unsubscribe();
    }
  }, [user]);

  return {
    requestPermission,
    permissionStatus,
    isSupported: typeof window !== 'undefined' && 'Notification' in window
  };
}
