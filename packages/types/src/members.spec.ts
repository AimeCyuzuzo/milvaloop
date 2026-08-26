import { describe, expect, it } from 'vitest';

import { acceptInviteSchema, inviteLookupResultSchema, updateReminderPauseSchema } from './members.js';

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
    });
    expect(result.success).toBe(true);
  });

  it('accepts a pending invite with no account yet', () => {
    const result = inviteLookupResultSchema.safeParse({
      status: 'pending',
      email: 'invitee@example.com',
      tenantName: 'Umurenge Savings Group',
      hasAccount: false,
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
