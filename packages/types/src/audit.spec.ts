import { describe, expect, it } from 'vitest';

import { auditEventSchema } from './audit.js';

describe('auditEventSchema', () => {
  const valid = {
    id: '11111111-1111-4111-8111-111111111111',
    action: 'member.invited',
    entityType: 'membership_invite',
    entityId: '22222222-2222-4222-8222-222222222222',
    metadata: { email: 'new-member@example.com' },
    actor: { name: 'Founder Person', email: 'founder@example.com' },
    createdAt: '2026-08-24T12:00:00.000Z',
  };

  it('accepts a valid event with an actor', () => {
    expect(auditEventSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts a null actor — system-initiated events have no human actor', () => {
    expect(auditEventSchema.safeParse({ ...valid, actor: null }).success).toBe(true);
  });

  it('accepts a null entityId', () => {
    expect(auditEventSchema.safeParse({ ...valid, entityId: null }).success).toBe(true);
  });

  it('accepts an empty metadata object', () => {
    expect(auditEventSchema.safeParse({ ...valid, metadata: {} }).success).toBe(true);
  });

  it('rejects a malformed createdAt', () => {
    expect(auditEventSchema.safeParse({ ...valid, createdAt: 'not-a-date' }).success).toBe(false);
  });

  it('rejects a malformed actor email', () => {
    expect(auditEventSchema.safeParse({ ...valid, actor: { email: 'not-an-email' } }).success).toBe(false);
  });
});
