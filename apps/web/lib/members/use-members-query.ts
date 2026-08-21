import { useQuery } from '@tanstack/react-query';
import type { MemberListResponse } from '@milvaloop/types';

import { apiFetch } from '../api/api-fetch';

export const MEMBERS_QUERY_KEY = ['members'] as const;

export function useMembersQuery() {
  return useQuery({
    queryKey: MEMBERS_QUERY_KEY,
    queryFn: () => apiFetch<MemberListResponse>('/members'),
  });
}
