import { pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

import { users } from './users.js';

// One-time passwordless login links (see CODE_QUALITY.md's rate-limiting
// note on the magic-link-request endpoint). Only a hash of the token is
// stored; the raw token exists only in the emailed link. NOT scoped to a
// tenant — a user is a single global identity across every cooperative
// they belong to, so "prove you own this email" is resolved before any
// cooperative is chosen (see AuthService.finishLogin).
export const magicLinkTokens = pgTable('magic_link_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 255 }).notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
