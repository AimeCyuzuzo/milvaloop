import { integer, pgTable, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

import { tenants } from './tenants.js';

// A record of which "Premium access ending" reminder emails have already
// gone out for a tenant, so the daily cron never sends the same
// days-remaining trigger twice — same bookkeeping-not-money reasoning as
// contribution_reminders.ts. `daysRemaining` is the threshold that fired
// (21, 14, 7, ...), not a live countdown.
export const tenantTrialReminders = pgTable(
  'tenant_trial_reminders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    daysRemaining: integer('days_remaining').notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.tenantId, table.daysRemaining)],
);
