'use client';

import { useEffect } from 'react';

import { useSessionStore } from './session-store';
import { useCurrentSessionQuery } from './use-current-session';

// Renders nothing — just keeps useSessionStore in sync with the ['auth',
// 'me'] query, so every session update (initial load, login, logout, a
// mutation's own cache write) flows through one path instead of each
// call site setting Zustand state itself.
export function SessionBootstrap() {
  const { data, isSuccess, isError } = useCurrentSessionQuery();
  const setSession = useSessionStore((state) => state.setSession);

  useEffect(() => {
    if (isSuccess) {
      setSession(data);
    } else if (isError) {
      setSession(null);
    }
  }, [isSuccess, isError, data, setSession]);

  return null;
}
