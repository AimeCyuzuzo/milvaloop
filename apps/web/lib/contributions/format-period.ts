const PERIOD_LABEL_FORMATTER = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'long', timeZone: 'UTC' });

export function formatPeriodLabel(period: string): string {
  return PERIOD_LABEL_FORMATTER.format(new Date(period));
}

export function formatAmount(amount: number): string {
  return `${amount.toLocaleString('en-US')} RWF`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
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

// The first day of the month after `period` — mirrors
// contributions-waterfall.ts's identical helper on the backend. Duplicated
// rather than shared for the same reason currentPeriod's truncation logic
// is: the two sides have no other reason to depend on each other.
export function nextPeriod(period: string): string {
  const parts = period.split('-').map(Number);
  const year = parts[0] ?? 0;
  const month = parts[1] ?? 0;
  const next = new Date(Date.UTC(year, month, 1));
  const nextMonth = String(next.getUTCMonth() + 1).padStart(2, '0');
  return `${next.getUTCFullYear()}-${nextMonth}-01`;
}

// The first day of the month before `period` — symmetric to nextPeriod,
// same Date.UTC roll-under trick one month earlier. Used to manually
// extend the historical-entry grid's column range backward past whatever
// it computed on its own.
export function previousPeriod(period: string): string {
  const parts = period.split('-').map(Number);
  const year = parts[0] ?? 0;
  const month = parts[1] ?? 0;
  const previous = new Date(Date.UTC(year, month - 2, 1));
  const previousMonth = String(previous.getUTCMonth() + 1).padStart(2, '0');
  return `${previous.getUTCFullYear()}-${previousMonth}-01`;
}
