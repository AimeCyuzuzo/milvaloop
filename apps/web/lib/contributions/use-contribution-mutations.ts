import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  ApproveAllPendingResponse,
  PreviewAllocationInput,
  PreviewAllocationResponse,
  RecordContributionInput,
  RecordHistoricalBatchInput,
  RecordHistoricalBatchResponse,
  RejectContributionInput,
  SetSharePriceInput,
  SharePrice,
  UnapproveContributionInput,
  UpdateSharePriceInput,
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

export function useRecordHistoricalBatchMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RecordHistoricalBatchInput) =>
      apiFetch<RecordHistoricalBatchResponse>('/contributions/import', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CONTRIBUTIONS_QUERY_KEY }),
  });
}

// A convenience over approving one at a time after a large import — see
// ContributionsService.approveAllPending.
export function useApproveAllPendingMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<ApproveAllPendingResponse>('/contributions/approve-all-pending', { method: 'POST' }),
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

export function useUnapproveContributionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ contributionId, ...input }: UnapproveContributionInput & { contributionId: string }) =>
      apiFetch<void>(`/contributions/${contributionId}/unapprove`, { method: 'POST', body: JSON.stringify(input) }),
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

export function useUpdateSharePriceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ priceId, ...input }: UpdateSharePriceInput & { priceId: string }) =>
      apiFetch<SharePrice>(`/contributions/settings/${priceId}`, { method: 'PATCH', body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CONTRIBUTIONS_QUERY_KEY }),
  });
}

export function useDeleteSharePriceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (priceId: string) => apiFetch<void>(`/contributions/settings/${priceId}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CONTRIBUTIONS_QUERY_KEY }),
  });
}
