'use client';

import React from 'react';
import { AuthProvider } from '@/contexts/AuthContext';

// ============================================
// Providers — Client-side context wrappers
// ============================================

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      {children}
    </AuthProvider>
  );
}
