import { isNull } from 'drizzle-orm';
import { pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

import { tenants } from './tenants.js';
import { users } from './users.js';

// An existing member inviting someone else into their cooperative. Mirrors
// the magic_link_tokens/password_reset_tokens shape (hashed single-use
// token, expiresAt, consumedAt) with two differences those don't have: this
// is inherently tenant-scoped (an invite is into one specific cooperative,
// same reasoning as email_verification_tokens keeping tenantId), and it's
// keyed by `email`, not `userId` — the invitee may not have a MilvaLoop
// account yet.
export const membershipInvites = pgTable(
  'membership_invites',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    email: varchar('email', { length: 255 }).notNull(),
    // Granted on acceptance, same shape as memberships.permissions.
    permissions: text('permissions').array().notNull().default([]),
    invitedByUserId: uuid('invited_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 255 }).notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    // Also the revoke marker, not just the accept marker — an invite an
    // admin revokes before it's accepted gets consumedAt set too, rather
    // than being deleted outright. Deleting it would orphan the audit event
    // that recorded the revoke (see audit_events.entityId).
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Prevents two simultaneous pending invites to the same email in the
    // same cooperative without blocking re-inviting once the first one is
    // consumed or revoked — a real constraint, not a check-then-write gap.
    uniqueIndex('membership_invites_pending_email_unique')
      .on(table.tenantId, table.email)
      .where(isNull(table.consumedAt)),
  ],
);
