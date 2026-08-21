import { jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

import { tenants } from './tenants.js';
import { users } from './users.js';

// The first table for the audit-event log — the product's own explainability
// requirement (see MAIN.md and PLATFORM_BRAINSTORMING.md), not optional
// observability infrastructure to add later. Every tenant-scoped mutation
// this product cares about explaining writes one row here, in the same
// transaction as the mutation itself (a recorded event that outlives, or
// never accompanies, the change it describes defeats the point).
//
// Deliberately one flat table, not a table per domain — cheap to start with,
// and every future feature's audit trail follows this same shape unless
// that's revisited once real usage shows a reason to.
export const auditEvents = pgTable('audit_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  // Null for system-initiated events (an invite auto-expiring, etc.) — not
  // every event has a human actor.
  actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
  // Dot-namespaced, e.g. "member.invited", "member.permissions_updated".
  action: varchar('action', { length: 100 }).notNull(),
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  entityId: uuid('entity_id'),
  // Action-specific detail, e.g. { email, permissions } on an invite,
  // { before, after } on a permissions edit.
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
