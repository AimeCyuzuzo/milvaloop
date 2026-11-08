import {
  computeWaterfallAllocations,
  nextPeriod,
  previousPeriod,
  type OutstandingPeriod,
} from './contributions-waterfall';

describe('nextPeriod / previousPeriod', () => {
  it('nextPeriod advances to the first of the following month', () => {
    expect(nextPeriod('2026-08-01')).toBe('2026-09-01');
  });

  it('nextPeriod rolls over the year boundary', () => {
    expect(nextPeriod('2026-12-01')).toBe('2027-01-01');
  });

  it('previousPeriod steps back to the first of the prior month', () => {
    expect(previousPeriod('2026-09-01')).toBe('2026-08-01');
  });

  it('previousPeriod rolls back over the year boundary', () => {
    expect(previousPeriod('2027-01-01')).toBe('2026-12-01');
  });

  it('previousPeriod undoes nextPeriod', () => {
    expect(previousPeriod(nextPeriod('2026-03-01'))).toBe('2026-03-01');
  });
});

describe('computeWaterfallAllocations', () => {
  it('allocates an exact single-share payment to one untouched period', () => {
    const periods: OutstandingPeriod[] = [
      { period: '2026-08-01', dueAmount: 50_000, alreadyPaid: 0 },
    ];

    const result = computeWaterfallAllocations(periods, 50_000, 50_000);

    expect(result).toEqual([{ period: '2026-08-01', amount: 50_000 }]);
  });

  it('leaves no dangling zero-amount entry when the amount exactly exhausts on a period boundary', () => {
    const periods: OutstandingPeriod[] = [
      { period: '2026-08-01', dueAmount: 50_000, alreadyPaid: 0 },
    ];

    const result = computeWaterfallAllocations(periods, 50_000, 50_000);

    expect(result).toHaveLength(1);
  });

  it('spreads a clean multi-month lump sum across consecutive untouched periods', () => {
    const periods: OutstandingPeriod[] = [
      { period: '2026-08-01', dueAmount: 50_000, alreadyPaid: 0 },
      { period: '2026-09-01', dueAmount: 50_000, alreadyPaid: 0 },
      { period: '2026-10-01', dueAmount: 50_000, alreadyPaid: 0 },
    ];

    const result = computeWaterfallAllocations(periods, 150_000, 50_000);

    expect(result).toEqual([
      { period: '2026-08-01', amount: 50_000 },
      { period: '2026-09-01', amount: 50_000 },
      { period: '2026-10-01', amount: 50_000 },
    ]);
  });

  it('tops up an old partial before rolling the remainder into a fresh period', () => {
    // August already has 30,000 of its 50,000 share; a new 30,000
    // contribution should close the 20,000 gap and start September.
    const periods: OutstandingPeriod[] = [
      { period: '2026-08-01', dueAmount: 50_000, alreadyPaid: 30_000 },
      { period: '2026-09-01', dueAmount: 50_000, alreadyPaid: 0 },
    ];

    const result = computeWaterfallAllocations(periods, 30_000, 50_000);

    expect(result).toEqual([
      { period: '2026-08-01', amount: 20_000 },
      { period: '2026-09-01', amount: 10_000 },
    ]);
  });

  it('rolls a surplus forward into a synthesized period rather than stacking it into the current one', () => {
    // Everything else is settled; only the next month is known. 70,000
    // should satisfy it in full and start the month after that.
    const periods: OutstandingPeriod[] = [
      { period: '2026-09-01', dueAmount: 50_000, alreadyPaid: 0 },
    ];

    const result = computeWaterfallAllocations(periods, 70_000, 50_000);

    expect(result).toEqual([
      { period: '2026-09-01', amount: 50_000 },
      { period: '2026-10-01', amount: 20_000 },
    ]);
  });

  it('rolls a synthesized period across a year boundary', () => {
    const periods: OutstandingPeriod[] = [
      { period: '2026-12-01', dueAmount: 50_000, alreadyPaid: 0 },
    ];

    const result = computeWaterfallAllocations(periods, 70_000, 50_000);

    expect(result).toEqual([
      { period: '2026-12-01', amount: 50_000 },
      { period: '2027-01-01', amount: 20_000 },
    ]);
  });

  it('leaves a small partial without completing the period when the amount is not enough', () => {
    const periods: OutstandingPeriod[] = [
      { period: '2026-08-01', dueAmount: 50_000, alreadyPaid: 0 },
    ];

    const result = computeWaterfallAllocations(periods, 20_000, 50_000);

    expect(result).toEqual([{ period: '2026-08-01', amount: 20_000 }]);
  });

  it('skips an already-satisfied period and moves on to the next outstanding one', () => {
    const periods: OutstandingPeriod[] = [
      { period: '2026-07-01', dueAmount: 50_000, alreadyPaid: 50_000 },
      { period: '2026-08-01', dueAmount: 50_000, alreadyPaid: 0 },
    ];

    const result = computeWaterfallAllocations(periods, 30_000, 50_000);

    expect(result).toEqual([{ period: '2026-08-01', amount: 30_000 }]);
  });

  it('throws if given no starting period at all', () => {
    expect(() => computeWaterfallAllocations([], 50_000, 50_000)).toThrow();
  });
});
