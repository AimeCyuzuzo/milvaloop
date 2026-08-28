import { useQuery } from '@tanstack/react-query';
import type { ContributionListQuery, ContributionListResponse } from '@milvaloop/types';

import { apiFetch } from '../api/api-fetch';
import { CONTRIBUTIONS_QUERY_KEY } from './contributions-query-keys';

export function useContributionsQuery(filters: ContributionListQuery = {}) {
  const params = new URLSearchParams();
  if (filters.status) {
    params.set('status', filters.status);
  }
  if (filters.membershipId) {
    params.set('membershipId', filters.membershipId);
  }
  const query = params.toString();

  return useQuery({
    queryKey: [...CONTRIBUTIONS_QUERY_KEY, 'list', filters],
    queryFn: () => apiFetch<ContributionListResponse>(`/contributions${query ? `?${query}` : ''}`),
  });
}
