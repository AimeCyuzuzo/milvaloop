import type { AllocationProposalLine } from '@milvaloop/types';

import { formatAmount, formatPeriodLabel, nextPeriod } from './format-period';

// The waterfall's own proposal is always valid on its own — every
// adjustment here is a transform of that proposal, never a blank field the
// recorder fills in by hand. There is exactly one thing worth adjusting,
// at exactly one place: the *tail* of the proposal, where a surplus was
// rolled forward into a new period by default. That surplus can instead be
// kept as extra shares in the period before it. Toggling is reversible and
// cascades — clicking it repeatedly walks the tail backward or forward one
// period at a time — so there is never a way to reach a combination that
// doesn't sum to the original amount or that points at an invalid period.

function isStacked(line: AllocationProposalLine): boolean {
  return line.amount > line.sharePriceAmount;
}

// True whenever there's a valid move in either direction: merging the tail
// backward needs a previous line to merge into, but splitting a stacked
// tail back out doesn't — it only needs the last line to actually be
// stacked, even if that's the only line left in the proposal.
export function canAdjustTail(lines: AllocationProposalLine[]): boolean {
  const last = lastOf(lines);
  if (!last) {
    return false;
  }
  return lines.length >= 2 || isStacked(last);
}

function lastOf(lines: AllocationProposalLine[]): AllocationProposalLine | undefined {
  return lines[lines.length - 1];
}

export function tailToggleLabel(lines: AllocationProposalLine[]): string {
  const last = lastOf(lines);
  if (!last) {
    return '';
  }
  if (isStacked(last)) {
    return `Split the extra ${formatAmount(last.amount - last.sharePriceAmount)} into ${formatPeriodLabel(nextPeriod(last.period))} instead`;
  }
  const previous = lines[lines.length - 2];
  if (!previous) {
    return '';
  }
  return `Add this to ${formatPeriodLabel(previous.period)} instead`;
}

// Folds the last line into the one before it — the "keep it as extra
// shares here, don't advance it" choice.
export function stackLastLine(lines: AllocationProposalLine[]): AllocationProposalLine[] {
  const last = lastOf(lines);
  const previous = lines[lines.length - 2];
  if (!last || !previous) {
    return lines;
  }
  const merged: AllocationProposalLine = {
    ...previous,
    amount: previous.amount + last.amount,
    resultingStatus: 'satisfied',
  };
  return [...lines.slice(0, -2), merged];
}

// The reverse: peels one share's worth off an already-stacked last line and
// starts a new period with whatever's left over.
export function splitLastLine(lines: AllocationProposalLine[]): AllocationProposalLine[] {
  const last = lastOf(lines);
  if (!last || !isStacked(last)) {
    return lines;
  }
  const remainder = last.amount - last.sharePriceAmount;
  const trimmed: AllocationProposalLine = { ...last, amount: last.sharePriceAmount, resultingStatus: 'satisfied' };
  const period = nextPeriod(last.period);
  const created: AllocationProposalLine = {
    period,
    amount: remainder,
    sharePriceAmount: last.sharePriceAmount,
    alreadyPaidBefore: 0,
    resultingStatus: remainder >= last.sharePriceAmount ? 'satisfied' : 'partial',
  };
  return [...lines.slice(0, -1), trimmed, created];
}

export function toggleTail(lines: AllocationProposalLine[]): AllocationProposalLine[] {
  const last = lastOf(lines);
  if (!last) {
    return lines;
  }
  return isStacked(last) ? splitLastLine(lines) : stackLastLine(lines);
}

// The "why" under each line — always computed from the ledger's own
// numbers, never something the recorder has to infer themselves.
export function describeAllocationLine(line: AllocationProposalLine, index: number): string {
  const totalAfter = line.alreadyPaidBefore + line.amount;
  const isAdvance = index > 0;

  if (line.alreadyPaidBefore > 0) {
    return totalAfter >= line.sharePriceAmount
      ? `Completes this month — was ${formatAmount(line.alreadyPaidBefore)} of ${formatAmount(line.sharePriceAmount)}`
      : `Adds to this month — was ${formatAmount(line.alreadyPaidBefore)} of ${formatAmount(line.sharePriceAmount)}`;
  }
  if (isStacked(line)) {
    return `${formatAmount(line.sharePriceAmount)} due, plus ${formatAmount(line.amount - line.sharePriceAmount)} extra`;
  }
  if (isAdvance) {
    return totalAfter >= line.sharePriceAmount ? 'Paying ahead' : 'Partial advance payment';
  }
  return totalAfter >= line.sharePriceAmount ? 'Due this period' : 'Partial payment';
}
