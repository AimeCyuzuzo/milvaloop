import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { SlugPreviewResult } from '@milvaloop/types';

import { apiFetch } from '../api/api-fetch';
import { useDebouncedValue } from '../hooks/use-debounced-value';

// Matches tenantSlugSchema's own minimum — no point asking the backend
// about a name shorter than the slug it would ever accept.
const MIN_NAME_LENGTH = 2;
const DEBOUNCE_MS = 400;

// Shows the address a cooperative will be created at, generated from its
// name (see AuthService.insertTenantAndMembership) — informational only,
// never user-edited. `keepPreviousData` avoids a flicker back to nothing
// between debounce windows while a new preview is loading.
export function useCooperativeSlugPreview(name: string) {
  const debouncedName = useDebouncedValue(name.trim(), DEBOUNCE_MS);

  const query = useQuery({
    queryKey: ['cooperatives', 'slug-preview', debouncedName],
    queryFn: () =>
      apiFetch<SlugPreviewResult>(`/cooperatives/slug-preview?name=${encodeURIComponent(debouncedName)}`),
    enabled: debouncedName.length >= MIN_NAME_LENGTH,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  return { slug: query.data?.slug };
}
