import { useQuery } from '@tanstack/react-query';
import type { AuditEventListResponse } from '@milvaloop/types';

import { apiFetch } from '../api/api-fetch';

export const AUDIT_EVENTS_QUERY_KEY = ['audit-events'] as const;

export function useAuditEventsQuery() {
  return useQuery({
    queryKey: AUDIT_EVENTS_QUERY_KEY,
    queryFn: () => apiFetch<AuditEventListResponse>('/audit-events'),
  });
}
