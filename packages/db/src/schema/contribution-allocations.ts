import { date, integer, pgTable, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

import { contributions } from './contributions.js';
import { sharePrices } from './share-prices.js';
import { tenants } from './tenants.js';

// Which period a contribution's money is meant to satisfy, and how much of
// it — the explicit link a recorder confirms (whether by accepting the
// waterfall proposal or editing it), never one the system infers silently
// after the fact. `period` is the first day of the calendar month it
// represents.
//
// `sharePriceId` is resolved once, when this row is first created (the
// share_prices row effective for `period` at that moment), and never
// re-resolved to a different row afterward — adding a new, later price
// point never changes what an already-recorded allocation pins to. That
// pinned row's own `amount` can still be corrected in place, though (see
// ContributionsService.updateSharePrice) — a period's due amount is read
// live from it, so such a correction intentionally does reach back and
// change what any period pinned to it shows as due; the app warns about
// that at the point of the edit rather than preventing it structurally.
//
// There is no separate "obligation" row to reference: a period's due
// amount is simply the pinned share price's amount, and a period's status
// and share count are always derived by summing the allocations that name
// it — nothing is stored beyond this table, contributions, and
// share_prices.
export const contributionAllocations = pgTable(
  'contribution_allocations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    contributionId: uuid('contribution_id')
      .notNull()
      .references(() => contributions.id, { onDelete: 'cascade' }),
    period: date('period', { mode: 'string' }).notNull(),
    amount: integer('amount').notNull(),
    sharePriceId: uuid('share_price_id')
      .notNull()
      .references(() => sharePrices.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  // One row per period per contribution — adjusting how much of a
  // contribution goes to a given month updates this row's amount, it never
  // appends a second row for the same (contribution, period) pair.
  (table) => [unique().on(table.contributionId, table.period)],
);
