import { integer, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

import { memberships } from './memberships.js';
import { tenants } from './tenants.js';

// A single payment event — the raw fact of money received, deliberately
// separate from which period(s) it satisfies (contribution_allocations)
// and from share ownership, which is never stored here or anywhere: both
// are always computed from approved allocations (see
// PLATFORM_BRAINSTORMING.md's Contribution ≠ Allocation ≠ Obligation ≠
// Share ownership separation).
export const contributions = pgTable('contributions', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  membershipId: uuid('membership_id')
    .notNull()
    .references(() => memberships.id, { onDelete: 'restrict' }),
  amount: integer('amount').notNull(),
  contributedAt: timestamp('contributed_at', { withTimezone: true }).notNull(),
  recordedByMembershipId: uuid('recorded_by_membership_id')
    .notNull()
    .references(() => memberships.id, { onDelete: 'restrict' }),
  // 'pending' | 'approved' | 'rejected'. A contribution only affects a
  // member's period status and share count once approved — recording and
  // approving are two distinct permissions, and the recorder of a given
  // contribution can never be its own approver, enforced where the
  // approval is granted, not by this column.
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  approvedByMembershipId: uuid('approved_by_membership_id').references(() => memberships.id, {
    onDelete: 'set null',
  }),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  note: text('note'),
  // Kept distinct from `note` (the recorder's own comment) so rejecting a
  // contribution never overwrites what the recorder originally wrote.
  rejectionReason: text('rejection_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
