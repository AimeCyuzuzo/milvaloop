import { describe, expect, it } from 'vitest';

import { computePremiumMonthlyFeeRwf } from './tenant-access.js';

describe('computePremiumMonthlyFeeRwf', () => {
  it('charges the base fee at and under the base member cap', () => {
    expect(computePremiumMonthlyFeeRwf(0)).toBe(12_000);
    expect(computePremiumMonthlyFeeRwf(29)).toBe(12_000);
    expect(computePremiumMonthlyFeeRwf(30)).toBe(12_000);
  });

  it('adds one tier as soon as the cap is crossed, not only once a full 10 are added', () => {
    expect(computePremiumMonthlyFeeRwf(31)).toBe(17_000);
    expect(computePremiumMonthlyFeeRwf(40)).toBe(17_000);
  });

  it('adds a second tier past 40', () => {
    expect(computePremiumMonthlyFeeRwf(41)).toBe(22_000);
    expect(computePremiumMonthlyFeeRwf(50)).toBe(22_000);
  });
});
