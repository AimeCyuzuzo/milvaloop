import { Injectable } from '@nestjs/common';
import { schema } from '@milvaloop/db';

import type { Transaction } from '../db/types';

const { auditEvents } = schema;

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

// The seed of the product's audit-event log (see MAIN.md's explainability
// requirement — this is a core feature, not optional observability
// infrastructure). One method, called inside the same transaction as the
// mutation it describes — an audit entry that outlives, or never
// accompanies, the change it records defeats the point.
@Injectable()
export class AuditLogService {
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
}
