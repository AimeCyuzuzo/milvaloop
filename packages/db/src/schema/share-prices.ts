import { date, integer, pgTable, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

import { tenants } from './tenants.js';

// The RWF value of one share, over time. A new price point is its own row
// with its own effectiveFrom — raising or lowering the price going forward
// never touches an earlier row. A row's `amount` can still be corrected in
// place after the fact, though (see ContributionsService.updateSharePrice),
// for the one case that's for: fixing a value that was wrong from the
// start. Because contribution_allocations pins the specific row it used
// (see that table's own comment), such a correction reaches back and
// changes what any period already recorded against this row shows as due
// — the app warns about that at the point of the edit rather than
// preventing it, since the alternative (a wrong historical price staying
// wrong forever once anyone has paid against it) defeats the point of
// being able to fix it at all.
//
// Which row applies to a given calendar period, absent a contribution
// already pinned to a specific one, is "the latest one whose effectiveFrom
// is on or before that period's start" — a share bought to satisfy an old
// month is priced at what a share cost *then*, not at today's price, even
// if the cooperative has since changed it.
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
