// Today's calendar date as 'YYYY-MM-DD', UTC — used wherever a `date`-mode
// column (memberSince, share_prices.effectiveFrom-style fields) needs
// "today" rather than a full timestamp. UTC avoids the server's local
// timezone shifting the date by a day around midnight.
export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}
