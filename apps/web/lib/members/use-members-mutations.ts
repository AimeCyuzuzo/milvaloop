import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AcceptInviteInput, AuthSession, InviteMemberInput, PendingInvite, UpdateMemberPermissionsInput } from '@milvaloop/types';

import { apiFetch } from '../api/api-fetch';
import { applyIssuedSession, useLoginResultMutation } from '../auth/use-auth-mutations';
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

// Only ever reached once useInviteLookupQuery reports hasAccount: false —
// see docs/plans/invite-accept-rework.md. Still returns the LoginResult
// union (a brand-new user could, in principle, already belong to other
// cooperatives if their email was reused some other way) even though in
// practice it's almost always 'authenticated'.
export function useAcceptInviteMutation() {
  return useLoginResultMutation<AcceptInviteInput>('/members/invites/accept');
}

// The authenticated path — the caller already has a session, so this only
// ever adds a membership to *that* account and returns a session scoped to
// the tenant just joined (no ticket/picker dance, there's no ambiguity when
// identity is already proven). Doesn't fit useLoginResultMutation (that's
// for endpoints that might still need a cooperative picker) or
// useIssueSessionMutation (that's always skipAuth: true) — it needs the
// caller's own auth header attached, so it's its own thing here.
export function useJoinInviteMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (token: string) => apiFetch<AuthSession>(`/members/invites/${encodeURIComponent(token)}/join`, { method: 'POST' }),
    onSuccess: (session) => applyIssuedSession(queryClient, session),
  });
}
