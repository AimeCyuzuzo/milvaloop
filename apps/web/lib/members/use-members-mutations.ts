import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AcceptInviteInput, InviteMemberInput, PendingInvite, UpdateMemberPermissionsInput } from '@milvaloop/types';

import { apiFetch } from '../api/api-fetch';
import { useLoginResultMutation } from '../auth/use-auth-mutations';
import { MEMBERS_QUERY_KEY } from './use-members-query';

export function useInviteMemberMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: InviteMemberInput) => apiFetch<PendingInvite>('/members/invite', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MEMBERS_QUERY_KEY }),
  });
}

export function useRevokeInviteMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (inviteId: string) => apiFetch<void>(`/members/invites/${inviteId}/revoke`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MEMBERS_QUERY_KEY }),
  });
}

export function useUpdateMemberPermissionsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ membershipId, ...input }: UpdateMemberPermissionsInput & { membershipId: string }) =>
      apiFetch<void>(`/members/${membershipId}/permissions`, { method: 'PATCH', body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MEMBERS_QUERY_KEY }),
  });
}

export function useRemoveMemberMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (membershipId: string) => apiFetch<void>(`/members/${membershipId}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MEMBERS_QUERY_KEY }),
  });
}

// Same LoginResult union as login/magic-link-consume (authenticated now,
// or a ticket to finish with) — see AuthService.finishLogin, which the
// backend's accept-invite reuses directly.
export function useAcceptInviteMutation() {
  return useLoginResultMutation<AcceptInviteInput>('/members/invites/accept');
}
