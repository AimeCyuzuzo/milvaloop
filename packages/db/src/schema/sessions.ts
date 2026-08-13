import { pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

import { tenants } from './tenants.js';
import { users } from './users.js';

// One row per issued refresh token. Only a hash of the token is stored,
// mirroring how passwords are handled — the raw refresh token exists only
// in the user's httpOnly cookie. A session is scoped to one (user, tenant)
// pair: the tenant a person logs into is fixed at login, since it comes
// from the cooperative's own subdomain.
export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  refreshTokenHash: varchar('refresh_token_hash', { length: 255 }).notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  // Set when the token is rotated (refresh) or the user logs out, instead of
  // deleting the row — keeps a record of when a session ended and why.
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
