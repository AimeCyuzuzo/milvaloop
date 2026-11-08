import { useQuery } from '@tanstack/react-query';
import type { ComplianceSummary } from '@milvaloop/types';

import { apiFetch } from '../api/api-fetch';
import { CONTRIBUTIONS_QUERY_KEY } from './contributions-query-keys';

// Errors with 400 until the cooperative has a share price set (see
// ContributionsService.getTenantComplianceSummary) — callers gate this
// with `enabled` on whatever already tells them setup is done (e.g.
// useShareSettingsQuery's `current`), the same way the Contributions page
// itself avoids calling anything else in the feature too early.
export function useComplianceSummaryQuery(enabled = true) {
  return useQuery({
    queryKey: [...CONTRIBUTIONS_QUERY_KEY, 'compliance-summary'],
    queryFn: () => apiFetch<ComplianceSummary>('/contributions/compliance-summary'),
    enabled,
  });
}
