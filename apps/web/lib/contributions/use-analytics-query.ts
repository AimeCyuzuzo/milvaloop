import { useQuery } from '@tanstack/react-query';
import type { AnalyticsResponse } from '@milvaloop/types';

import { apiFetch } from '../api/api-fetch';
import { CONTRIBUTIONS_QUERY_KEY } from './contributions-query-keys';

// Errors with 400 until the cooperative has a share price set, same as
// useComplianceSummaryQuery — callers gate this with `enabled` the same
// way.
export function useAnalyticsQuery(enabled = true) {
  return useQuery({
    queryKey: [...CONTRIBUTIONS_QUERY_KEY, 'analytics'],
    queryFn: () => apiFetch<AnalyticsResponse>('/contributions/analytics'),
    enabled,
  });
}
