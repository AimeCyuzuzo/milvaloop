import { date, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

import { tenants } from './tenants.js';
import { users } from './users.js';

// Join table between users and tenants. A signup creates a user, a tenant,
// and this membership together in one transaction (see CODE_QUALITY.md).
// `permissions` is the least-privilege list checked on the backend on every
// protected route — never inferred from the frontend.
export const memberships = pgTable(
  'memberships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    permissions: text('permissions').array().notNull().default([]),
    // The date this person actually became a member of the cooperative —
    // set explicitly by whoever creates the row, never a DB-level default.
    // A self-service signup or a normal invite-accept always uses today
    // (a person can't retroactively claim they joined earlier than their
    // own account exists); only administrator-entered historical data
    // (a placeholder member, an Excel import) can assert an earlier date.
    // This is what a member's first obligation period is anchored to —
    // deliberately kept separate from `createdAt` below, which only ever
    // means "when this row was created," so backdating history never has
    // to lie about that.
    memberSince: date('member_since', { mode: 'string' }).notNull(),
    // Removal is soft, not a DELETE — a future contribution (or an audit
    // event) can still reference this membership after the person has left,
    // which matters more here than most soft-delete cases: explainability
    // requires a member's contribution history to survive their departure,
    // not disappear with the row. Every query that lists "current members"
    // filters removedAt IS NULL.
    removedAt: timestamp('removed_at', { withTimezone: true }),
    // Set by an admin to quietly exempt this member from the automated
    // contribution-reminder cron (illness, hardship, a known in-person
    // arrangement) without a formal waiver flow. Checked only by that job —
    // it has no other effect.
    remindersPausedAt: timestamp('reminders_paused_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  // (userId, tenantId) stays unique across a soft-removed row too — re-
  // adding someone who left the same cooperative must UPDATE their existing
  // row (clear removedAt, reset permissions) rather than INSERT a second
  // one, or the accept-invite flow will hit this constraint.
  (table) => [unique().on(table.userId, table.tenantId)],
);
