import { describe, expect, it } from 'vitest';

import {
  createCooperativeSchema,
  createFirstCooperativeSchema,
  loginResultSchema,
  loginSchema,
  magicLinkConsumeSchema,
  magicLinkRequestSchema,
  selectCooperativeSchema,
  signupSchema,
  switchCooperativeSchema,
} from './auth.js';

const validSignup = {
  tenantName: 'Umurenge Savings Group',
  name: 'Founder Person',
  email: 'founder@example.com',
  password: 'correct-horse-battery',
};

describe('signupSchema', () => {
  it('accepts a well-formed signup, no slug field', () => {
    expect(signupSchema.safeParse(validSignup).success).toBe(true);
  });

  it('rejects a password under 8 characters', () => {
    const result = signupSchema.safeParse({ ...validSignup, password: 'short' });
    expect(result.success).toBe(false);
  });

  it('rejects a malformed email', () => {
    const result = signupSchema.safeParse({ ...validSignup, email: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('rejects an empty tenant name', () => {
    const result = signupSchema.safeParse({ ...validSignup, tenantName: '' });
    expect(result.success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('accepts email + any non-empty password, no cooperative field', () => {
    const result = loginSchema.safeParse({ email: 'founder@example.com', password: 'x' });
    expect(result.success).toBe(true);
  });

  it('rejects an empty password', () => {
    const result = loginSchema.safeParse({ email: 'founder@example.com', password: '' });
    expect(result.success).toBe(false);
  });

  it('rejects a missing email', () => {
    expect(loginSchema.safeParse({ password: 'x' }).success).toBe(false);
  });
});

describe('magicLinkRequestSchema', () => {
  it('requires only an email', () => {
    expect(magicLinkRequestSchema.safeParse({ email: 'founder@example.com' }).success).toBe(true);
    expect(magicLinkRequestSchema.safeParse({}).success).toBe(false);
  });
});

describe('magicLinkConsumeSchema', () => {
  it('rejects an empty token', () => {
    expect(magicLinkConsumeSchema.safeParse({ token: '' }).success).toBe(false);
  });

  it('accepts a non-empty token', () => {
    expect(magicLinkConsumeSchema.safeParse({ token: 'abc123' }).success).toBe(true);
  });
});

describe('loginResultSchema', () => {
  it('accepts an authenticated result (full session shape)', () => {
    const result = loginResultSchema.safeParse({
      status: 'authenticated',
      accessToken: 'token',
      user: { id: '11111111-1111-4111-8111-111111111111', name: 'A Person', email: 'a@example.com', emailVerified: false },
      tenant: {
        id: '11111111-1111-4111-8111-111111111111',
        name: 'Coop',
        slug: 'coop',
        onboardedAt: '2024-01-01T00:00:00.000Z',
      },
      permissions: [],
      cooperatives: [],
    });
    expect(result.success).toBe(true);
  });

  it('accepts a selection_required result', () => {
    const result = loginResultSchema.safeParse({
      status: 'selection_required',
      ticket: 'a-ticket',
      cooperatives: [{ id: '11111111-1111-4111-8111-111111111111', name: 'Coop', slug: 'coop' }],
    });
    expect(result.success).toBe(true);
  });

  it('accepts a no_cooperatives result', () => {
    const result = loginResultSchema.safeParse({ status: 'no_cooperatives', ticket: 'a-ticket' });
    expect(result.success).toBe(true);
  });

  it('rejects a missing or unknown status discriminant', () => {
    expect(loginResultSchema.safeParse({ ticket: 'a-ticket' }).success).toBe(false);
    expect(loginResultSchema.safeParse({ status: 'something-else' }).success).toBe(false);
  });
});

describe('selectCooperativeSchema', () => {
  it('requires a ticket and a cooperative id', () => {
    expect(
      selectCooperativeSchema.safeParse({ ticket: 't', cooperativeId: '11111111-1111-4111-8111-111111111111' })
        .success,
    ).toBe(true);
    expect(selectCooperativeSchema.safeParse({ ticket: 't' }).success).toBe(false);
  });
});

describe('createFirstCooperativeSchema', () => {
  it('requires a ticket and a name, no slug field', () => {
    const result = createFirstCooperativeSchema.safeParse({ ticket: 't', name: 'Coop' });
    expect(result.success).toBe(true);
  });

  it('rejects a missing name', () => {
    const result = createFirstCooperativeSchema.safeParse({ ticket: 't' });
    expect(result.success).toBe(false);
  });
});

describe('switchCooperativeSchema', () => {
  it('requires a cooperative id, no ticket', () => {
    expect(switchCooperativeSchema.safeParse({ cooperativeId: '11111111-1111-4111-8111-111111111111' }).success).toBe(
      true,
    );
    expect(switchCooperativeSchema.safeParse({}).success).toBe(false);
  });
});

describe('createCooperativeSchema', () => {
  it('accepts a well-formed cooperative, no slug field', () => {
    expect(createCooperativeSchema.safeParse({ name: 'Coop' }).success).toBe(true);
  });

  it('rejects an empty name', () => {
    expect(createCooperativeSchema.safeParse({ name: '' }).success).toBe(false);
  });
});
