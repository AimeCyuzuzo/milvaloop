import { create } from 'zustand';
import type { CurrentSession } from '@milvaloop/types';

interface SessionState {
  /** null means "not logged in" — distinct from "not checked yet", tracked separately by the /auth/me query's own loading state. */
  session: CurrentSession | null;
  setSession: (session: CurrentSession | null) => void;
}

// Mirrors the TanStack Query ['auth', 'me'] cache (see use-current-session.ts)
// so components that need the current user/tenant/permissions synchronously
// — a layout gating a route, a nav bar — don't each have to run their own
// query. The access token itself lives in token-store.ts, not here.
export const useSessionStore = create<SessionState>((set) => ({
  session: null,
  setSession: (session) => set({ session }),
}));
