'use client';

import { useState, useEffect, useCallback } from 'react';
import { checkForUpdate } from '@/lib/version';
import type { AppVersion } from '@/types';

// ============================================
// useVersionCheck — Checks for app updates
// ============================================

interface UseVersionCheckReturn {
  versionInfo: AppVersion | null;
  hasUpdate: boolean;
  isChecking: boolean;
  dismiss: () => void;
}

export function useVersionCheck(): UseVersionCheckReturn {
  const [versionInfo, setVersionInfo] = useState<AppVersion | null>(null);
  const [hasUpdate, setHasUpdate] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const info = await checkForUpdate();
        if (!cancelled) {
          setVersionInfo(info);
          setHasUpdate(info.hasUpdate);
        }
      } catch (error) {
        console.warn('[useVersionCheck] Failed:', error);
      } finally {
        if (!cancelled) setIsChecking(false);
      }
    }

    check();
    return () => { cancelled = true; };
  }, []);

  const dismiss = useCallback(() => {
    setHasUpdate(false);
  }, []);

  return { versionInfo, hasUpdate, isChecking, dismiss };
}
