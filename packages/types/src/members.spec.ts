import { describe, expect, it } from 'vitest';

import {
  acceptInviteSchema,
  addPlaceholderMemberSchema,
  inviteLoginSchema,
  inviteLookupResultSchema,
  memberImportMappingSchema,
  updateReminderPauseSchema,
} from './members.js';

describe('acceptInviteSchema', () => {
  it('accepts a token, name, and password', () => {
    const result = acceptInviteSchema.safeParse({
      token: 'abc123',
      name: 'New Member',
      password: 'correct-horse-battery',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a missing password — this endpoint is only for the no-account case now', () => {
    const result = acceptInviteSchema.safeParse({ token: 'abc123' });
    expect(result.success).toBe(false);
  });

  it('rejects a password under 8 characters', () => {
    const result = acceptInviteSchema.safeParse({ token: 'abc123', name: 'New Member', password: 'short' });
    expect(result.success).toBe(false);
  });

  it('rejects an empty token', () => {
    const result = acceptInviteSchema.safeParse({
      token: '',
      name: 'New Member',
      password: 'correct-horse-battery',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an empty name', () => {
    const result = acceptInviteSchema.safeParse({ token: 'abc123', name: '', password: 'correct-horse-battery' });
    expect(result.success).toBe(false);
  });
});

describe('inviteLookupResultSchema', () => {
  it('accepts a pending invite with an account already on file', () => {
    const result = inviteLookupResultSchema.safeParse({
      status: 'pending',
      email: 'invitee@example.com',
      tenantName: 'Umurenge Savings Group',
      hasAccount: true,
      isClaim: false,
      claimName: null,
    });
    expect(result.success).toBe(true);
  });

  it('accepts a pending invite with no account yet', () => {
    const result = inviteLookupResultSchema.safeParse({
      status: 'pending',
      email: 'invitee@example.com',
      tenantName: 'Umurenge Savings Group',
      hasAccount: false,
      isClaim: false,
      claimName: null,
    });
    expect(result.success).toBe(true);
  });

  it('accepts a claim-login invite for an existing placeholder member', () => {
    const result = inviteLookupResultSchema.safeParse({
      status: 'pending',
      email: 'invitee@example.com',
      tenantName: 'Umurenge Savings Group',
      hasAccount: false,
      isClaim: true,
      claimName: 'Beata Uwase',
    });
    expect(result.success).toBe(true);
  });

  it('accepts expired, consumed, and invalid with no other fields', () => {
    expect(inviteLookupResultSchema.safeParse({ status: 'expired' }).success).toBe(true);
    expect(inviteLookupResultSchema.safeParse({ status: 'consumed' }).success).toBe(true);
    expect(inviteLookupResultSchema.safeParse({ status: 'invalid' }).success).toBe(true);
  });

  it('rejects a pending status missing hasAccount', () => {
    const result = inviteLookupResultSchema.safeParse({
      status: 'pending',
      email: 'invitee@example.com',
      tenantName: 'Umurenge Savings Group',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unrecognized status', () => {
    expect(inviteLookupResultSchema.safeParse({ status: 'revoked' }).success).toBe(false);
  });
});

describe('updateReminderPauseSchema', () => {
  it('accepts pausing and resuming', () => {
    expect(updateReminderPauseSchema.safeParse({ paused: true }).success).toBe(true);
    expect(updateReminderPauseSchema.safeParse({ paused: false }).success).toBe(true);
  });

  it('rejects a non-boolean value', () => {
    expect(updateReminderPauseSchema.safeParse({ paused: 'true' }).success).toBe(false);
  });

  it('rejects a missing paused field', () => {
    expect(updateReminderPauseSchema.safeParse({}).success).toBe(false);
  });
});

describe('addPlaceholderMemberSchema', () => {
  it('accepts a name and a member-since date', () => {
    const result = addPlaceholderMemberSchema.safeParse({ name: 'Beata Uwase', memberSince: '2023-01-01' });
    expect(result.success).toBe(true);
  });

  it('rejects an empty name', () => {
    const result = addPlaceholderMemberSchema.safeParse({ name: '', memberSince: '2023-01-01' });
    expect(result.success).toBe(false);
  });

  it('rejects a malformed memberSince', () => {
    const result = addPlaceholderMemberSchema.safeParse({ name: 'Beata Uwase', memberSince: 'not-a-date' });
    expect(result.success).toBe(false);
  });
});

describe('inviteLoginSchema', () => {
  it('accepts a valid email', () => {
    expect(inviteLoginSchema.safeParse({ email: 'beata@example.com' }).success).toBe(true);
  });

  it('rejects a malformed email', () => {
    expect(inviteLoginSchema.safeParse({ email: 'not-an-email' }).success).toBe(false);
  });
});

describe('memberImportMappingSchema', () => {
  it('accepts a single name column with no email column', () => {
    const result = memberImportMappingSchema.safeParse({ nameColumns: [0], memberSince: '2023-01-01' });
    expect(result.success).toBe(true);
  });

  it('accepts combined name columns and an email column', () => {
    const result = memberImportMappingSchema.safeParse({
      nameColumns: [0, 1],
      emailColumn: 2,
      memberSince: '2023-01-01',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty nameColumns array', () => {
    const result = memberImportMappingSchema.safeParse({ nameColumns: [], memberSince: '2023-01-01' });
    expect(result.success).toBe(false);
  });
});
