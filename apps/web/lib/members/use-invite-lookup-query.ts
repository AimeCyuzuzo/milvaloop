import { useQuery } from '@tanstack/react-query';
import type { InviteLookupResult } from '@milvaloop/types';

import { apiFetch } from '../api/api-fetch';

// Read-only, never consumes the invite (unlike accept/join) — safe to call
// on every load of the accept page, including a reload after the invite's
// already been used. See docs/plans/invite-accept-rework.md.
export function useInviteLookupQuery(token: string | null) {
  return useQuery({
    queryKey: ['members', 'invites', 'lookup', token],
    queryFn: () => apiFetch<InviteLookupResult>(`/members/invites/lookup?token=${encodeURIComponent(token ?? '')}`),
    enabled: !!token,
    retry: false,
  });
}
