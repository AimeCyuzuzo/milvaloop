import { useQuery } from '@tanstack/react-query';
import type { CurrentSession } from '@milvaloop/types';

import { apiFetch } from '../api/api-fetch';

export const CURRENT_SESSION_QUERY_KEY = ['auth', 'me'] as const;

// On a hard refresh the in-memory access token is gone (by design — see
// token-store.ts), so this request goes out with no Authorization header,
// gets a 401, and apiFetch transparently tries the httpOnly refresh cookie
// before retrying. If that also fails, the user is simply not logged in —
// not an error worth retrying further.
export function useCurrentSessionQuery() {
  return useQuery({
    queryKey: CURRENT_SESSION_QUERY_KEY,
    queryFn: () => apiFetch<CurrentSession>('/auth/me'),
    retry: false,
  });
}
