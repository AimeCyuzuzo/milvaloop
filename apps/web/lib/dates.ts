// Today's calendar date as 'YYYY-MM-DD', for a form field that defaults to
// "now" but is otherwise a plain date (contributedAt, memberSince) — never
// a full timestamp.
export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}
