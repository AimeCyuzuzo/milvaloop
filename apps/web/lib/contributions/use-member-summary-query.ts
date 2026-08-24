import { useQuery } from '@tanstack/react-query';
import type { MemberContributionSummary } from '@milvaloop/types';

import { apiFetch } from '../api/api-fetch';
import { CONTRIBUTIONS_QUERY_KEY } from './contributions-query-keys';

export function useMemberSummaryQuery(membershipId: string | undefined) {
  return useQuery({
    queryKey: [...CONTRIBUTIONS_QUERY_KEY, 'members', membershipId, 'summary'],
    queryFn: () => apiFetch<MemberContributionSummary>(`/contributions/members/${membershipId}/summary`),
    enabled: !!membershipId,
  });
}
