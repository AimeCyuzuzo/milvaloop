import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type {
  AuthSession,
  ChangePasswordInput,
  CreateCooperativeInput,
  CreateFirstCooperativeInput,
  CurrentSession,
  EmailVerificationConsumeInput,
  ForgotPasswordInput,
  LoginInput,
  LoginResult,
  MagicLinkConsumeInput,
  MagicLinkRequestInput,
  ResetPasswordInput,
  SelectCooperativeInput,
  SignupInput,
  SwitchCooperativeInput,
  UpdateProfileInput,
} from '@milvaloop/types';

import { apiFetch } from '../api/api-fetch';
import { setAccessToken } from './token-store';
import { CURRENT_SESSION_QUERY_KEY } from './use-current-session';

// Shared by every mutation that resolves to a session for a specific
// tenant — signup, login, switching cooperatives, creating one, joining one
// via invite. Every cache entry keyed without a tenant id (members,
// contributions, anything scoped to "the current cooperative") is wiped
// first: refetching only the queries a naive diff thinks are "affected"
// left a real cross-tenant bug — switching cooperatives kept the *previous*
// tenant's members/contributions/etc. sitting in cache, visible until each
// individual query happened to refetch on its own schedule. `clear()`
// removes every cached query outright, then the session query is
// immediately re-seeded so the app shell doesn't flash a signed-out state
// while every other mounted query naturally refetches fresh for the new
// tenant.
export function applyIssuedSession(queryClient: QueryClient, session: AuthSession) {
  queryClient.clear();
  setAccessToken(session.accessToken);
  queryClient.setQueryData(CURRENT_SESSION_QUERY_KEY, {
    user: session.user,
    tenant: session.tenant,
    permissions: session.permissions,
    cooperatives: session.cooperatives,
  });
}

// Defaults to skipAuth: true because most callers are pre-authentication
// (signup, a login-ticket-based select/create). switchCooperative and
// createCooperative are the exception — already-authenticated endpoints —
// and must override this, or apiFetch never attaches the access token and
// AccessTokenGuard rejects the request with a 401 before it even reaches
// the handler.
function useIssueSessionMutation<TInput>(path: string, options: { skipAuth?: boolean } = { skipAuth: true }) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: TInput) =>
      apiFetch<AuthSession>(path, { method: 'POST', body: JSON.stringify(input), skipAuth: options.skipAuth }),
    onSuccess: (session) => applyIssuedSession(queryClient, session),
  });
}

// login, magic-link/consume, and (see use-members-mutations.ts)
// invites/accept all return this same union — the cooperative isn't known
// yet if there's more than one, so only the 'authenticated' branch writes
// to the session cache. The page itself handles the other two branches (it
// needs the ticket/cooperative list to render a picker).
export function useLoginResultMutation<TInput>(path: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: TInput) =>
      apiFetch<LoginResult>(path, { method: 'POST', body: JSON.stringify(input), skipAuth: true }),
    onSuccess: (result) => {
      if (result.status === 'authenticated') {
        applyIssuedSession(queryClient, result);
      }
    },
  });
}

// Shared by mutations that just perform an action and return a message —
// no session to store.
function useAuthActionMutation<TInput = void>(path: string, options: { skipAuth?: boolean } = {}) {
  return useMutation({
    mutationFn: (input: TInput) =>
      apiFetch<{ message: string }>(path, {
        method: 'POST',
        body: input === undefined ? undefined : JSON.stringify(input),
        skipAuth: options.skipAuth,
      }),
  });
}

export function useSignupMutation() {
  return useIssueSessionMutation<SignupInput>('/auth/signup');
}

export function useLoginMutation() {
  return useLoginResultMutation<LoginInput>('/auth/login');
}

export function useConsumeMagicLinkMutation() {
  return useLoginResultMutation<MagicLinkConsumeInput>('/auth/magic-link/consume');
}

export function useSelectCooperativeMutation() {
  return useIssueSessionMutation<SelectCooperativeInput>('/auth/cooperatives/select');
}

export function useCreateFirstCooperativeMutation() {
  return useIssueSessionMutation<CreateFirstCooperativeInput>('/auth/cooperatives/create-from-ticket');
}

export function useSwitchCooperativeMutation() {
  return useIssueSessionMutation<SwitchCooperativeInput>('/auth/cooperatives/switch', { skipAuth: false });
}

export function useCreateCooperativeMutation() {
  return useIssueSessionMutation<CreateCooperativeInput>('/cooperatives', { skipAuth: false });
}

// No longer issues a session — the caller logs in fresh with the new
// password (see AuthService.resetPassword's session-revocation note).
export function useResetPasswordMutation() {
  return useAuthActionMutation<ResetPasswordInput>('/auth/password/reset', { skipAuth: true });
}

export function useRequestMagicLinkMutation() {
  return useAuthActionMutation<MagicLinkRequestInput>('/auth/magic-link/request', { skipAuth: true });
}

export function useForgotPasswordMutation() {
  return useAuthActionMutation<ForgotPasswordInput>('/auth/password/forgot', { skipAuth: true });
}

export function useVerifyEmailMutation() {
  return useAuthActionMutation<EmailVerificationConsumeInput>('/auth/email/verify', { skipAuth: true });
}

// Authenticated — see AuthController: resend only ever targets the caller's
// own account, so there's nothing to pass in the body.
export function useResendVerificationMutation() {
  return useAuthActionMutation<undefined>('/auth/email/resend');
}

export function useChangePasswordMutation() {
  return useAuthActionMutation<ChangePasswordInput>('/auth/password/change');
}

// Patches the cached session's name directly rather than refetching —
// every other page reading it (the sidebar, "who did this" labels once
// they next load) picks up the change immediately, the same way
// applyIssuedSession seeds the cache after login instead of waiting on a
// refetch.
export function useUpdateProfileMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateProfileInput) =>
      apiFetch<void>('/auth/profile', { method: 'PATCH', body: JSON.stringify(input) }),
    onSuccess: (_data, input) => {
      queryClient.setQueryData<CurrentSession>(CURRENT_SESSION_QUERY_KEY, (current) =>
        current ? { ...current, user: { ...current.user, name: input.name } } : current,
      );
    },
  });
}

// Marks the active tenant's guided setup wizard done (see
// AuthService.completeOnboarding) — patches the cached session directly,
// same reasoning as useUpdateProfileMutation, so AppLayout's onboarding
// gate sees the change immediately without a refetch.
export function useCompleteOnboardingMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiFetch<void>('/cooperatives/complete-onboarding', { method: 'POST' }),
    onSuccess: () => {
      queryClient.setQueryData<CurrentSession>(CURRENT_SESSION_QUERY_KEY, (current) =>
        current
          ? { ...current, tenant: { ...current.tenant, onboardedAt: new Date().toISOString() } }
          : current,
      );
    },
  });
}

export function useLogoutMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiFetch<void>('/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      // Same reasoning as applyIssuedSession — a stale tenant-scoped cache
      // surviving logout would leak into whichever account logs in next in
      // this same tab.
      queryClient.clear();
      setAccessToken(null);
      queryClient.setQueryData(CURRENT_SESSION_QUERY_KEY, null);
    },
  });
}
