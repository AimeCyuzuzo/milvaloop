import { pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  // Null until the founder finishes (or explicitly skips) the guided setup
  // — share price, members, historical contributions — that a newly
  // created tenant is walked through before reaching the normal
  // dashboard. Checked on every request as the gate into that flow, not
  // just at signup, so a second cooperative created later goes through it
  // too.
  onboardedAt: timestamp('onboarded_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
