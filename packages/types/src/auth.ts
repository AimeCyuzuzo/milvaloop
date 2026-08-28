import { z } from 'zod';

import { cooperativeNameSchema, cooperativeSummarySchema } from './tenant.js';

const emailSchema = z.email();
export const passwordSchema = z.string().min(8, 'Password must be at least 8 characters');
// A person's real name, shown everywhere an account's identity is
// displayed instead of the email — every account has one, since email is
// a login credential, not something you'd want to see in a member list or
// an activity feed.
export const personNameSchema = z.string().min(1).max(255);

// Founder signup: creates a user, a tenant, and the founding membership
// together (see CODE_QUALITY.md's transaction example). No slug field — the
// cooperative's address is generated from tenantName, never typed (see
// tenant.ts's slugify and AuthService.insertTenantAndMembership).
export const signupSchema = z.object({
  tenantName: cooperativeNameSchema,
  name: personNameSchema,
  email: emailSchema,
  password: passwordSchema,
});
export type SignupInput = z.infer<typeof signupSchema>;

// No cooperative field — a user is one global identity across every
// cooperative they belong to. Which one (if any) this resolves to is
// decided after the password check, not before (see loginResultSchema).
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const magicLinkRequestSchema = z.object({
  email: emailSchema,
});
export type MagicLinkRequestInput = z.infer<typeof magicLinkRequestSchema>;

export const magicLinkConsumeSchema = z.object({
  token: z.string().min(1),
});
export type MagicLinkConsumeInput = z.infer<typeof magicLinkConsumeSchema>;

export const emailVerificationConsumeSchema = z.object({
  token: z.string().min(1),
});
export type EmailVerificationConsumeInput = z.infer<typeof emailVerificationConsumeSchema>;

// Same shape as requesting a magic link (just an email, no cooperative —
// a password belongs to the user, not to a membership). Kept as a
// reference rather than a separate duplicate literal so the two don't
// silently drift if either changes independently later.
export const forgotPasswordSchema = magicLinkRequestSchema;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// PATCH /auth/profile — a person's own name, editable independently of
// their password (see AuthController). No currentPassword check here,
// unlike changePasswordSchema — a display name isn't a security credential.
export const updateProfileSchema = z.object({
  name: personNameSchema,
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// Returned by signup, refresh, and every endpoint that finishes resolving
// a specific cooperative (select/switch/create). The refresh token itself
// is never in this body — it's set as an httpOnly cookie.
export const authSessionSchema = z.object({
  accessToken: z.string(),
  user: z.object({
    id: z.uuid(),
    name: z.string(),
    email: z.email(),
    emailVerified: z.boolean(),
  }),
  tenant: z.object({
    id: z.uuid(),
    name: z.string(),
    slug: z.string(),
    // Null until this cooperative's founder finishes (or skips) the
    // guided setup wizard — the frontend redirects into it whenever this
    // is null rather than showing the normal dashboard (see
    // apps/web/app/(app)/layout.tsx).
    onboardedAt: z.iso.datetime().nullable(),
  }),
  permissions: z.array(z.string()),
  // Every cooperative this user holds a membership in, not just the
  // current one — lets the frontend render a cooperative switcher without
  // a second request. Safe to return: it's the caller's own memberships.
  cooperatives: z.array(cooperativeSummarySchema),
});
export type AuthSession = z.infer<typeof authSessionSchema>;

// GET /auth/me — same shape minus the access token, which the caller
// already has (this endpoint identifies the current session, it doesn't
// reissue one).
export const currentSessionSchema = authSessionSchema.omit({ accessToken: true });
export type CurrentSession = z.infer<typeof currentSessionSchema>;

// POST /auth/login and POST /auth/magic-link/consume both resolve to one
// of three outcomes once identity is proven, branching on how many
// cooperatives the user belongs to:
//   - exactly 1 -> 'authenticated', a full session, same as today.
//   - 0 or many -> a short-lived ticket (never a full session — there's no
//     single tenant yet to embed in an access token). The ticket is later
//     exchanged for a session at POST /auth/cooperatives/select (many
//     case) or POST /auth/cooperatives/create-from-ticket (zero case),
//     without proving identity a second time.
export const loginResultSchema = z.discriminatedUnion('status', [
  authSessionSchema.extend({ status: z.literal('authenticated') }),
  z.object({
    status: z.literal('selection_required'),
    ticket: z.string(),
    cooperatives: z.array(cooperativeSummarySchema),
  }),
  z.object({
    status: z.literal('no_cooperatives'),
    ticket: z.string(),
  }),
]);
export type LoginResult = z.infer<typeof loginResultSchema>;

// POST /auth/cooperatives/select — finishes a 'selection_required' login.
export const selectCooperativeSchema = z.object({
  ticket: z.string().min(1),
  cooperativeId: z.uuid(),
});
export type SelectCooperativeInput = z.infer<typeof selectCooperativeSchema>;

// POST /auth/cooperatives/create-from-ticket — finishes a 'no_cooperatives'
// login by creating the user's first cooperative, no password re-entry. No
// slug field, same reasoning as signupSchema.
export const createFirstCooperativeSchema = z.object({
  ticket: z.string().min(1),
  name: cooperativeNameSchema,
});
export type CreateFirstCooperativeInput = z.infer<typeof createFirstCooperativeSchema>;

// POST /auth/cooperatives/switch — an already-authenticated user moving to
// a DIFFERENT membership they already hold. No ticket needed — the access
// token already proves identity.
export const switchCooperativeSchema = z.object({
  cooperativeId: z.uuid(),
});
export type SwitchCooperativeInput = z.infer<typeof switchCooperativeSchema>;

// POST /cooperatives — an already-authenticated user creating a brand-new
// cooperative. Distinct from signup: no new user, no email/password. No
// slug field, same reasoning as signupSchema.
export const createCooperativeSchema = z.object({
  name: cooperativeNameSchema,
});
export type CreateCooperativeInput = z.infer<typeof createCooperativeSchema>;
