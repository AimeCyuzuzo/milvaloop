import { useQuery } from '@tanstack/react-query';
import type { ContributionDetailResponse } from '@milvaloop/types';

import { apiFetch } from '../api/api-fetch';
import { CONTRIBUTIONS_QUERY_KEY } from './contributions-query-keys';

// Fetched on demand when the details drawer opens, not embedded in every
// ledger row — most rows never get their drawer opened, so there's no
// reason for the main list to carry every contribution's full allocation
// breakdown up front.
export function useContributionDetailQuery(contributionId: string, enabled: boolean) {
  return useQuery({
    queryKey: [...CONTRIBUTIONS_QUERY_KEY, contributionId, 'detail'],
    queryFn: () => apiFetch<ContributionDetailResponse>(`/contributions/${contributionId}`),
    enabled,
  });
}
