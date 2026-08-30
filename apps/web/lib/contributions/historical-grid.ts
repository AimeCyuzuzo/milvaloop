import type { AnalyticsMemberRow } from '@milvaloop/types';

import { nextPeriod } from './format-period';

// The historical-entry grid's state: one amount per (member, period) cell,
// empty meaning "not yet paid". Flat-keyed rather than nested — every fill
// operation and the grid itself only ever needs to read/write one cell or
// list keys for one member, which a flat map does with less bookkeeping
// than a nested Record<membershipId, Record<period, amount>> would.
export type GridState = Map<string, number>;

// Exported (not just used internally) — the grid's cell-selection state
// builds the same keys to know which (member, period) pairs are selected,
// without duplicating this format elsewhere.
export function cellKey(membershipId: string, period: string): string {
  return `${membershipId}|${period}`;
}

export function getCell(grid: GridState, membershipId: string, period: string): number | undefined {
  return grid.get(cellKey(membershipId, period));
}

export function setCell(grid: GridState, membershipId: string, period: string, amount: number): GridState {
  const next = new Map(grid);
  if (amount <= 0) {
    next.delete(cellKey(membershipId, period));
  } else {
    next.set(cellKey(membershipId, period), amount);
  }
  return next;
}

// Every period from `start` through `end` inclusive, both 'YYYY-MM-01'.
export function monthsBetween(start: string, end: string): string[] {
  const months: string[] = [];
  let cursor = start;
  while (cursor <= end) {
    months.push(cursor);
    cursor = nextPeriod(cursor);
  }
  return months;
}

// What's already on record for each (member, period) the grid shows —
// the analytics report's own per-member period breakdown, reused as-is
// rather than a second endpoint, since it already covers every period
// since the cooperative's first share price. `paidAmount` only counts
// approved allocations (see ContributionsService), matching "recorded"
// everywhere else in this app — a pending entry from this same grid
// doesn't count as a floor until it's approved either. Cells the grid
// starts with are seeded from this map so a period that's already
// covered never shows as blank, which is what let the same amount get
// entered and saved twice with nothing to say it had already happened.
export function buildBaselineGrid(members: AnalyticsMemberRow[], periods: string[]): GridState {
  const periodSet = new Set(periods);
  const baseline: GridState = new Map();
  for (const member of members) {
    for (const periodStatus of member.periods) {
      if (periodSet.has(periodStatus.period) && periodStatus.paidAmount > 0) {
        baseline.set(cellKey(member.membershipId, periodStatus.period), periodStatus.paidAmount);
      }
    }
  }
  return baseline;
}

// How much of a cell's displayed amount is genuinely new, i.e. above
// whatever baseline already covers it — what buildHistoricalEntries below
// actually submits, and what the page's own "N cells filled" summary
// should count instead of the grid's raw (baseline-included) values.
function deltaFor(grid: GridState, baseline: GridState, key: string): number {
  const value = grid.get(key) ?? 0;
  const already = baseline.get(key) ?? 0;
  return value - already;
}

export function computeDeltaSummary(grid: GridState, baseline: GridState): { cellCount: number; amount: number } {
  let cellCount = 0;
  let amount = 0;
  for (const key of grid.keys()) {
    const delta = deltaFor(grid, baseline, key);
    if (delta > 0) {
      cellCount += 1;
      amount += delta;
    }
  }
  return { cellCount, amount };
}

// Fills the same amount into every (member, period) cell in range — a
// per-cell overwrite, so re-running it or editing one cell afterward never
// needs to "undo" anything, it just changes that one cell. Never overwrites
// a cell down below what's already recorded for it (see buildBaselineGrid) —
// a bulk fill is meant to cover gaps, not undercut a period that's already
// paid.
export function applyBulkFill(
  grid: GridState,
  membershipIds: string[],
  amount: number,
  periods: string[],
  baseline: GridState,
): GridState {
  let next = grid;
  for (const membershipId of membershipIds) {
    for (const period of periods) {
      const key = cellKey(membershipId, period);
      next = setCell(next, membershipId, period, Math.max(amount, baseline.get(key) ?? 0));
    }
  }
  return next;
}

// Splits `totalAmount` evenly across `periods` for each member — the
// remainder from an uneven division goes to the oldest month, the same
// convention the real payment waterfall uses for a leftover amount, so
// the split behaves the way this product's money math already does
// everywhere else. Also floor-clamped per cell like applyBulkFill — a
// period the floor bumps up means the member ends up with more than an
// exact even split, which is the correct trade-off against ever silently
// undercutting a period that's already paid.
export function applyEvenSplit(
  grid: GridState,
  membershipIds: string[],
  totalAmount: number,
  periods: string[],
  baseline: GridState,
): GridState {
  const base = Math.floor(totalAmount / periods.length);
  const remainder = totalAmount - base * periods.length;

  let next = grid;
  for (const membershipId of membershipIds) {
    periods.forEach((period, index) => {
      const amount = index === 0 ? base + remainder : base;
      const key = cellKey(membershipId, period);
      next = setCell(next, membershipId, period, Math.max(amount, baseline.get(key) ?? 0));
    });
  }
  return next;
}

// Fills an explicit, arbitrary set of cells (already-built `cellKey`
// strings) with one amount — what the grid's own click-and-shift-click
// cell selection uses, as opposed to applyBulkFill's member×period
// cartesian product. Floor-clamped per cell for the same reason.
export function applyToCells(grid: GridState, cellKeys: string[], amount: number, baseline: GridState): GridState {
  let next = grid;
  for (const key of cellKeys) {
    const [membershipId, period] = key.split('|');
    if (!membershipId || !period) {
      continue;
    }
    const clamped = Math.max(amount, baseline.get(key) ?? 0);
    next = setCell(next, membershipId, period, clamped);
  }
  return next;
}

export interface HistoricalGridEntry {
  membershipId: string;
  contributedAt: string;
  allocations: Array<{ period: string; amount: number }>;
}

// One entry per member with at least one cell above its own baseline —
// the shape POST /contributions/import expects. Only the amount *above*
// whatever's already recorded for that (member, period) is submitted (see
// buildBaselineGrid/deltaFor): a cell left exactly at its baseline, or
// edited down toward it (the floor the input/fill helpers already clamp
// to), contributes nothing, so reopening this page and saving again can
// never double up a period that's already covered. `contributedAt` is the
// last topped-up period in that member's own row, a reasonable stand-in
// for "when this was recorded" on a historical entry where the real
// payment dates are long past and not individually tracked.
export function buildHistoricalEntries(grid: GridState, membershipIds: string[], baseline: GridState): HistoricalGridEntry[] {
  const entries: HistoricalGridEntry[] = [];
  for (const membershipId of membershipIds) {
    const allocations = [...grid.entries()]
      .filter(([key]) => key.startsWith(`${membershipId}|`))
      .map(([key, amount]) => ({ period: key.slice(membershipId.length + 1), amount: amount - (baseline.get(key) ?? 0) }))
      .filter((allocation) => allocation.amount > 0)
      .sort((a, b) => a.period.localeCompare(b.period));
    const latest = allocations[allocations.length - 1];
    if (!latest) {
      continue;
    }
    entries.push({
      membershipId,
      contributedAt: latest.period,
      allocations,
    });
  }
  return entries;
}
