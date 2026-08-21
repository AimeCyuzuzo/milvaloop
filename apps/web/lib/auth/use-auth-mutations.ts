import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type {
  AuthSession,
  ChangePasswordInput,
  CreateCooperativeInput,
  CreateFirstCooperativeInput,
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
} from '@milvaloop/types';

import { apiFetch } from '../api/api-fetch';
import { setAccessToken } from './token-store';
import { CURRENT_SESSION_QUERY_KEY } from './use-current-session';

// Shared by every mutation that returns a full, unambiguous session: store
// the access token and seed the ['auth', 'me'] cache directly rather than
// firing a redundant /auth/me request right after — everything reading the
// current session (including useSessionStore, via SessionBootstrap) picks
// this up the same way either way.
function applyIssuedSession(queryClient: QueryClient, session: AuthSession) {
  setAccessToken(session.accessToken);
  queryClient.setQueryData(CURRENT_SESSION_QUERY_KEY, {
    user: session.user,
    tenant: session.tenant,
    permissions: session.permissions,
    cooperatives: session.cooperatives,
  });
}

function useIssueSessionMutation<TInput>(path: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: TInput) =>
      apiFetch<AuthSession>(path, { method: 'POST', body: JSON.stringify(input), skipAuth: true }),
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
  return useIssueSessionMutation<SwitchCooperativeInput>('/auth/cooperatives/switch');
}

export function useCreateCooperativeMutation() {
  return useIssueSessionMutation<CreateCooperativeInput>('/cooperatives');
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

export function useLogoutMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiFetch<void>('/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      setAccessToken(null);
      queryClient.setQueryData(CURRENT_SESSION_QUERY_KEY, null);
    },
  });
}
