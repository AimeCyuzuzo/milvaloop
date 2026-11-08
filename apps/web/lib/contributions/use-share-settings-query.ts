import { useQuery } from '@tanstack/react-query';
import type { ShareSettingsResponse } from '@milvaloop/types';

import { apiFetch } from '../api/api-fetch';
import { CONTRIBUTIONS_QUERY_KEY } from './contributions-query-keys';

export function useShareSettingsQuery() {
  return useQuery({
    queryKey: [...CONTRIBUTIONS_QUERY_KEY, 'settings'],
    queryFn: () => apiFetch<ShareSettingsResponse>('/contributions/settings'),
  });
}
