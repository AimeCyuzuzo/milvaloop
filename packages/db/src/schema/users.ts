import { pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

// A user is a platform-wide identity, not a tenant-scoped one — a person's
// account can hold a membership in more than one tenant (see memberships.ts).
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  // Hashed with argon2, never stored or returned in plain text.
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
