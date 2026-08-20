import { pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

import { tenants } from './tenants.js';
import { users } from './users.js';

// One-time links used to confirm a user owns the email address they signed
// up with. Only a hash of the token is stored; the raw token exists only in
// the emailed link. Unlike magic-link/password-reset tokens, this one KEEPS
// tenantId — verification is only ever triggered at signup (exactly one
// tenant exists, no ambiguity) or via the authenticated resend endpoint
// (tenantId comes from already-verified access-token claims, not a lookup
// key). It's used purely to build the right email content (which
// cooperative this is for) — the effect of consuming one
// (setting users.emailVerifiedAt) is on the user, not the membership.
export const emailVerificationTokens = pgTable('email_verification_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 255 }).notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
