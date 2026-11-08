import { date, pgTable, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

import { tenants } from './tenants.js';

// A record of which tenants have already received their monthly digest for
// a given period, so the cron is safe to re-run without emailing the same
// summary twice — the same bookkeeping-not-money reasoning as
// contribution-reminders.ts. One row per tenant per period, not per
// member, since every member in a tenant receives identical content (see
// MonthlyDigestService).
export const monthlyDigests = pgTable(
  'monthly_digests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    period: date('period', { mode: 'string' }).notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.tenantId, table.period)],
);
