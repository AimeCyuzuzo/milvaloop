import { z } from 'zod';

// The product's own explainability requirement, surfaced as a read model
// (see MAIN.md and PLATFORM_BRAINSTORMING.md) — one row per event recorded
// by AuditLogService, shaped for direct display rather than exposing the
// raw table. `metadata` stays a free-form record here (it's genuinely
// different per `action`); the frontend's own describe-audit-event mapping
// is what turns it into a sentence, with a generic fallback for any action
// that mapping doesn't yet know about.
export const auditEventSchema = z.object({
  id: z.uuid(),
  action: z.string(),
  entityType: z.string(),
  entityId: z.uuid().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  actor: z.object({ email: z.email() }).nullable(),
  createdAt: z.iso.datetime(),
});
export type AuditEvent = z.infer<typeof auditEventSchema>;

// Returned by GET /audit-events.
export const auditEventListResponseSchema = z.object({
  events: z.array(auditEventSchema),
});
export type AuditEventListResponse = z.infer<typeof auditEventListResponseSchema>;
