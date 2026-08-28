import { describe, expect, it } from 'vitest';

import {
  allocationLineSchema,
  previewAllocationSchema,
  recordContributionSchema,
  recordHistoricalBatchSchema,
  rejectContributionSchema,
  setSharePriceSchema,
  updateSharePriceSchema,
} from './contributions.js';

describe('recordContributionSchema', () => {
  const valid = {
    membershipId: '11111111-1111-4111-8111-111111111111',
    amount: 50_000,
    contributedAt: '2026-08-15',
    allocations: [{ period: '2026-08-01', amount: 50_000 }],
  };

  it('accepts a valid single-period contribution', () => {
    expect(recordContributionSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts an optional note', () => {
    const result = recordContributionSchema.safeParse({ ...valid, note: 'Paid in cash' });
    expect(result.success).toBe(true);
  });

  it('rejects a zero amount', () => {
    expect(recordContributionSchema.safeParse({ ...valid, amount: 0 }).success).toBe(false);
  });

  it('rejects a negative amount', () => {
    expect(recordContributionSchema.safeParse({ ...valid, amount: -50_000 }).success).toBe(false);
  });

  it('rejects a non-integer amount', () => {
    expect(recordContributionSchema.safeParse({ ...valid, amount: 50_000.5 }).success).toBe(false);
  });

  it('rejects an empty allocations array — the schema requires at least one line, the service enforces the sum matches', () => {
    expect(recordContributionSchema.safeParse({ ...valid, allocations: [] }).success).toBe(false);
  });

  it('rejects a malformed period', () => {
    const result = recordContributionSchema.safeParse({
      ...valid,
      allocations: [{ period: 'August 2026', amount: 50_000 }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid membershipId', () => {
    expect(recordContributionSchema.safeParse({ ...valid, membershipId: 'not-a-uuid' }).success).toBe(false);
  });
});

describe('allocationLineSchema', () => {
  it('accepts a positive whole-RWF amount for a period', () => {
    expect(allocationLineSchema.safeParse({ period: '2026-08-01', amount: 20_000 }).success).toBe(true);
  });

  it('rejects a fractional amount', () => {
    expect(allocationLineSchema.safeParse({ period: '2026-08-01', amount: 20_000.25 }).success).toBe(false);
  });
});

describe('previewAllocationSchema', () => {
  it('accepts a membershipId and amount with no allocations yet', () => {
    const result = previewAllocationSchema.safeParse({
      membershipId: '11111111-1111-4111-8111-111111111111',
      amount: 150_000,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a missing amount', () => {
    const result = previewAllocationSchema.safeParse({ membershipId: '11111111-1111-4111-8111-111111111111' });
    expect(result.success).toBe(false);
  });
});

describe('rejectContributionSchema', () => {
  it('requires a non-empty reason', () => {
    expect(rejectContributionSchema.safeParse({ reason: '' }).success).toBe(false);
  });

  it('accepts a reason', () => {
    expect(rejectContributionSchema.safeParse({ reason: 'Duplicate entry' }).success).toBe(true);
  });
});

describe('setSharePriceSchema', () => {
  it('accepts a positive amount and a valid effective date', () => {
    const result = setSharePriceSchema.safeParse({ amount: 50_000, effectiveFrom: '2026-09-01' });
    expect(result.success).toBe(true);
  });

  it('rejects a zero amount', () => {
    expect(setSharePriceSchema.safeParse({ amount: 0, effectiveFrom: '2026-09-01' }).success).toBe(false);
  });

  it('rejects a malformed effective date', () => {
    expect(setSharePriceSchema.safeParse({ amount: 50_000, effectiveFrom: 'next month' }).success).toBe(false);
  });
});

describe('updateSharePriceSchema', () => {
  it('accepts a positive amount', () => {
    expect(updateSharePriceSchema.safeParse({ amount: 60_000 }).success).toBe(true);
  });

  it('rejects a zero amount', () => {
    expect(updateSharePriceSchema.safeParse({ amount: 0 }).success).toBe(false);
  });

  it('rejects a negative amount', () => {
    expect(updateSharePriceSchema.safeParse({ amount: -1 }).success).toBe(false);
  });

  it('rejects a non-integer amount', () => {
    expect(updateSharePriceSchema.safeParse({ amount: 60_000.5 }).success).toBe(false);
  });

  it('strips an effectiveFrom if sent — moving the price is not what this endpoint does', () => {
    const result = updateSharePriceSchema.safeParse({ amount: 60_000, effectiveFrom: '2026-09-01' });
    expect(result.success && 'effectiveFrom' in result.data).toBe(false);
  });
});

describe('recordHistoricalBatchSchema', () => {
  const entry = {
    membershipId: '11111111-1111-4111-8111-111111111111',
    contributedAt: '2024-01-31',
    allocations: [{ period: '2024-01-01', amount: 70_000 }],
  };

  it('accepts one or more entries, each with its own allocations', () => {
    const result = recordHistoricalBatchSchema.safeParse({ entries: [entry, { ...entry, contributedAt: '2024-02-29' }] });
    expect(result.success).toBe(true);
  });

  it('rejects an empty entries array', () => {
    expect(recordHistoricalBatchSchema.safeParse({ entries: [] }).success).toBe(false);
  });

  it('rejects an entry with no allocations', () => {
    const result = recordHistoricalBatchSchema.safeParse({ entries: [{ ...entry, allocations: [] }] });
    expect(result.success).toBe(false);
  });
});
