const PERIOD_LABEL_FORMATTER = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'long', timeZone: 'UTC' });

export function formatPeriodLabel(period: string): string {
  return PERIOD_LABEL_FORMATTER.format(new Date(period));
}

export function formatAmount(amount: number): string {
  return `${amount.toLocaleString('en-US')} RWF`;
}

// A period is always the first day of its month. The date picker lets
// someone click any day, so whichever one they land on is truncated here —
// mirroring the same truncation ContributionsService.setSharePrice applies
// server-side to effectiveFrom, since every period-keyed lookup on the
// backend compares exact first-of-month strings and would silently miss a
// period sent at day-level precision.
export function toPeriodStart(isoDate: string): string {
  return `${isoDate.slice(0, 7)}-01`;
}

export function currentPeriod(): string {
  return toPeriodStart(new Date().toISOString());
}
