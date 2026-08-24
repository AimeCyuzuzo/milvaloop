import { date, integer, pgTable, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

import { tenants } from './tenants.js';

// The RWF value of one share, over time. Append-only, enforced in the
// service layer, not by a DB trigger: a price is never edited or deleted
// once other rows may reference it, because contribution_allocations pins
// the specific row it used — inserting a corrected price is a new row with
// its own effectiveFrom, not a mutation of an old one.
//
// Which row applies to a given calendar period is "the latest one whose
// effectiveFrom is on or before that period's start" — a share bought to
// satisfy an old month is priced at what a share cost *then*, not at
// today's price, even if the cooperative has since changed it.
export const sharePrices = pgTable(
  'share_prices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    amount: integer('amount').notNull(),
    effectiveFrom: date('effective_from', { mode: 'string' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.tenantId, table.effectiveFrom)],
);
