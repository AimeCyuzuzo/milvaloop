import { z } from 'zod';

import { tenantSlugSchema } from './tenant.js';

const emailSchema = z.email();
const passwordSchema = z.string().min(8, 'Password must be at least 8 characters');

// Founder signup: creates a user, a tenant, and the founding membership
// together (see CODE_QUALITY.md's transaction example).
export const signupSchema = z.object({
  tenantName: z.string().min(1).max(255),
  tenantSlug: tenantSlugSchema,
  email: emailSchema,
  password: passwordSchema,
});
export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  tenantSlug: tenantSlugSchema,
  email: emailSchema,
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const magicLinkRequestSchema = z.object({
  tenantSlug: tenantSlugSchema,
  email: emailSchema,
});
export type MagicLinkRequestInput = z.infer<typeof magicLinkRequestSchema>;

export const magicLinkConsumeSchema = z.object({
  token: z.string().min(1),
});
export type MagicLinkConsumeInput = z.infer<typeof magicLinkConsumeSchema>;

// Returned by signup, login, refresh, and magic-link consume. The refresh
// token itself is never in this body — it's set as an httpOnly cookie.
export const authSessionSchema = z.object({
  accessToken: z.string(),
  user: z.object({
    id: z.uuid(),
    email: z.email(),
  }),
  tenant: z.object({
    id: z.uuid(),
    name: z.string(),
    slug: z.string(),
  }),
  permissions: z.array(z.string()),
});
export type AuthSession = z.infer<typeof authSessionSchema>;

// GET /auth/me — same shape minus the access token, which the caller
// already has (this endpoint identifies the current session, it doesn't
// reissue one).
export const currentSessionSchema = authSessionSchema.omit({ accessToken: true });
export type CurrentSession = z.infer<typeof currentSessionSchema>;
