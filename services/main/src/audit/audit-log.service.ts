import { Inject, Injectable } from '@nestjs/common';
import { desc, eq, schema, type Database } from '@milvaloop/db';
import type { AuditEventListResponse } from '@milvaloop/types';

import { DATABASE_CONNECTION } from '../db/db.module';
import type { Transaction } from '../db/types';

const { auditEvents, users } = schema;

export interface AuditEventInput {
  tenantId: string;
  // Null for system-initiated events (an invite auto-expiring, etc.) — not
  // every event has a human actor.
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

// Capped well above what a family/friends-scale cooperative could produce
// in practice — a safety net against unbounded growth, not a real paging
// mechanism (see GET /audit-events' own comment for why one isn't built
// yet).
const MAX_EVENTS_RETURNED = 200;

// The seed of the product's audit-event log (see MAIN.md's explainability
// requirement — this is a core feature, not optional observability
// infrastructure). `record` is called inside the same transaction as the
// mutation it describes — an audit entry that outlives, or never
// accompanies, the change it records defeats the point.
@Injectable()
export class AuditLogService {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Database) {}

  async record(tx: Transaction, event: AuditEventInput): Promise<void> {
    await tx.insert(auditEvents).values({
      tenantId: event.tenantId,
      actorUserId: event.actorUserId,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId,
      metadata: event.metadata ?? {},
    });
  }

  // GET /audit-events — full transparency (see MAIN.md's contributions
  // precedent): any active member can read the whole tenant's trail, not
  // just their own actions. `actor` is resolved from the plain `users`
  // table, not filtered to active memberships, so an event stays legible
  // even after its actor has since been removed from the tenant.
  async list(tenantId: string): Promise<AuditEventListResponse> {
    const rows = await this.db
      .select({
        id: auditEvents.id,
        action: auditEvents.action,
        entityType: auditEvents.entityType,
        entityId: auditEvents.entityId,
        metadata: auditEvents.metadata,
        actorEmail: users.email,
        createdAt: auditEvents.createdAt,
      })
      .from(auditEvents)
      .leftJoin(users, eq(auditEvents.actorUserId, users.id))
      .where(eq(auditEvents.tenantId, tenantId))
      .orderBy(desc(auditEvents.createdAt))
      .limit(MAX_EVENTS_RETURNED);

    return {
      events: rows.map((row) => ({
        id: row.id,
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId,
        metadata: row.metadata as Record<string, unknown>,
        actor: row.actorEmail ? { email: row.actorEmail } : null,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }
}
