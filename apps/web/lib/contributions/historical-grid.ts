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

// Fills the same amount into every (member, period) cell in range — a
// per-cell overwrite, so re-running it or editing one cell afterward never
// needs to "undo" anything, it just changes that one cell.
export function applyBulkFill(
  grid: GridState,
  membershipIds: string[],
  amount: number,
  periods: string[],
): GridState {
  let next = grid;
  for (const membershipId of membershipIds) {
    for (const period of periods) {
      next = setCell(next, membershipId, period, amount);
    }
  }
  return next;
}

// Splits `totalAmount` evenly across `periods` for each member — the
// remainder from an uneven division goes to the oldest month, the same
// convention the real payment waterfall uses for a leftover amount, so
// the split behaves the way this product's money math already does
// everywhere else.
export function applyEvenSplit(
  grid: GridState,
  membershipIds: string[],
  totalAmount: number,
  periods: string[],
): GridState {
  const base = Math.floor(totalAmount / periods.length);
  const remainder = totalAmount - base * periods.length;

  let next = grid;
  for (const membershipId of membershipIds) {
    periods.forEach((period, index) => {
      const amount = index === 0 ? base + remainder : base;
      next = setCell(next, membershipId, period, amount);
    });
  }
  return next;
}

// Fills an explicit, arbitrary set of cells (already-built `cellKey`
// strings) with one amount — what the grid's own click-and-shift-click
// cell selection uses, as opposed to applyBulkFill's member×period
// cartesian product.
export function applyToCells(grid: GridState, cellKeys: string[], amount: number): GridState {
  const next = new Map(grid);
  for (const key of cellKeys) {
    if (amount <= 0) {
      next.delete(key);
    } else {
      next.set(key, amount);
    }
  }
  return next;
}

export interface HistoricalGridEntry {
  membershipId: string;
  contributedAt: string;
  allocations: Array<{ period: string; amount: number }>;
}

// One entry per member with at least one filled cell — the shape
// POST /contributions/import expects. `contributedAt` is the last filled
// period in that member's own row, a reasonable stand-in for "when this
// was recorded" on a historical entry where the real payment dates are
// long past and not individually tracked.
export function buildHistoricalEntries(grid: GridState, membershipIds: string[]): HistoricalGridEntry[] {
  const entries: HistoricalGridEntry[] = [];
  for (const membershipId of membershipIds) {
    const allocations = [...grid.entries()]
      .filter(([key]) => key.startsWith(`${membershipId}|`))
      .map(([key, amount]) => ({ period: key.slice(membershipId.length + 1), amount }))
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
