import { date, pgTable, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core';

import { memberships } from './memberships.js';
import { tenants } from './tenants.js';

// A record of which reminder emails have already gone out, so the daily
// cron never sends the same trigger for the same period twice. This is
// bookkeeping about sends, not about money — unlike everything in
// contributions.ts/contribution-allocations.ts, it's fine for this to be a
// plain stored fact rather than something computed from the ledger.
export const contributionReminders = pgTable(
  'contribution_reminders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    membershipId: uuid('membership_id')
      .notNull()
      .references(() => memberships.id, { onDelete: 'cascade' }),
    period: date('period', { mode: 'string' }).notNull(),
    // 'due_soon' | 'overdue' — the same period can fire each kind once.
    kind: varchar('kind', { length: 20 }).notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.membershipId, table.period, table.kind)],
);
