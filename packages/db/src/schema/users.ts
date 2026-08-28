import { pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

// A user is a platform-wide identity, not a tenant-scoped one — a person's
// account can hold a membership in more than one tenant (see memberships.ts).
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  // Hashed with argon2, never stored or returned in plain text. A
  // placeholder member (see memberships.ts / claimedAt below) still gets a
  // real hash of a random, immediately-discarded value nobody can ever
  // know, rather than a nullable column — one less state to special-case
  // through login.
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
  // Null means this identity has no real login yet — a placeholder member
  // added by name only, with a synthetic email nobody can receive mail at.
  // Set the moment a person actually chooses their own password: at
  // self-service signup, normal invite-accept, and the claim-login flow
  // that turns a placeholder into a real account without disturbing the
  // membership row (and everything it already references) underneath it.
  // Checked explicitly by login/magic-link/reset, not relied on implicitly
  // via "nobody knows the random password."
  claimedAt: timestamp('claimed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
