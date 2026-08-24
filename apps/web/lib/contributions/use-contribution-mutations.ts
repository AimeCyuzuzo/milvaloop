import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  PreviewAllocationInput,
  PreviewAllocationResponse,
  RecordContributionInput,
  RejectContributionInput,
  SetSharePriceInput,
  SharePrice,
} from '@milvaloop/types';

import { apiFetch } from '../api/api-fetch';
import { CONTRIBUTIONS_QUERY_KEY } from './contributions-query-keys';

// Read-only — nothing to invalidate, the proposal is discarded the moment
// the dialog either submits it (record) or closes without submitting.
export function usePreviewAllocationMutation() {
  return useMutation({
    mutationFn: (input: PreviewAllocationInput) =>
      apiFetch<PreviewAllocationResponse>('/contributions/preview', { method: 'POST', body: JSON.stringify(input) }),
  });
}

export function useRecordContributionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RecordContributionInput) =>
      apiFetch<void>('/contributions', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CONTRIBUTIONS_QUERY_KEY }),
  });
}

export function useApproveContributionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (contributionId: string) => apiFetch<void>(`/contributions/${contributionId}/approve`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CONTRIBUTIONS_QUERY_KEY }),
  });
}

export function useRejectContributionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ contributionId, ...input }: RejectContributionInput & { contributionId: string }) =>
      apiFetch<void>(`/contributions/${contributionId}/reject`, { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CONTRIBUTIONS_QUERY_KEY }),
  });
}

export function useSetSharePriceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SetSharePriceInput) =>
      apiFetch<SharePrice>('/contributions/settings', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CONTRIBUTIONS_QUERY_KEY }),
  });
}
