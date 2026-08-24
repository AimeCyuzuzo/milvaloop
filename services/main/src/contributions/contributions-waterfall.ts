export interface OutstandingPeriod {
  period: string;
  dueAmount: number;
  alreadyPaid: number;
}

export interface WaterfallLine {
  period: string;
  amount: number;
}

// The first day of the calendar month after `period` ('YYYY-MM-DD').
// Date.UTC's month argument is 0-indexed, so passing the *current* period's
// 1-indexed month number (parsed straight from the string) lands on next
// month directly — no manual +1/-1 juggling, and UTC avoids any local
// timezone shifting the date by a day.
export function nextPeriod(period: string): string {
  const [year, month] = period.split('-').map(Number);
  const next = new Date(Date.UTC(year, month, 1));
  const nextMonth = String(next.getUTCMonth() + 1).padStart(2, '0');
  return `${next.getUTCFullYear()}-${nextMonth}-01`;
}

// Fills each period's remaining gap (dueAmount - alreadyPaid) in order,
// oldest first, never taking more than one period's gap by default — a
// surplus always rolls forward into the next period rather than stacking a
// second share into the same one (that's the "Adjust allocation" override's
// job, not this function's). Produces at most one trailing partial line,
// for whatever's left once the incoming amount runs out.
//
// `outstandingPeriods` must include at least one entry — the caller (see
// ContributionsService.getPeriodsSince) always supplies the next untouched
// period even when nothing is currently outstanding, since this function
// has no database access and can't discover a starting point on its own.
// `nextPeriodDueAmount` is the due amount used for any period this
// function has to synthesize past the end of that list (the tenant's
// current share price).
export function computeWaterfallAllocations(
  outstandingPeriods: OutstandingPeriod[],
  incomingAmount: number,
  nextPeriodDueAmount: number,
): WaterfallLine[] {
  if (outstandingPeriods.length === 0) {
    throw new Error(
      'computeWaterfallAllocations requires at least one period to start from',
    );
  }

  const periods = [...outstandingPeriods];
  const lines: WaterfallLine[] = [];
  let remaining = incomingAmount;
  let cursor = 0;

  while (remaining > 0) {
    let current = periods[cursor];
    if (!current) {
      const previous = periods[periods.length - 1];
      // periods is never empty here — it starts with at least one entry
      // and only ever grows — but the check keeps this branch honest
      // rather than asserting on an index the loop invariant guarantees.
      if (!previous) {
        throw new Error(
          'computeWaterfallAllocations lost track of its period cursor',
        );
      }
      current = {
        period: nextPeriod(previous.period),
        dueAmount: nextPeriodDueAmount,
        alreadyPaid: 0,
      };
      periods.push(current);
    }

    const gap = current.dueAmount - current.alreadyPaid;
    if (gap <= 0) {
      cursor += 1;
      continue;
    }

    const take = Math.min(gap, remaining);
    lines.push({ period: current.period, amount: take });
    remaining -= take;
    cursor += 1;
  }

  return lines;
}
