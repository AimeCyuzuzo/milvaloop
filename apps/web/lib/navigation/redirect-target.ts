// A `redirect` query param carries the page to return to after login (or
// away from login, if already authenticated) — see docs/plans/
// invite-accept-rework.md. Never trust it into router.push/replace without
// this check first: a raw value could be an absolute URL to another origin
// (`https://evil.example`) or a protocol-relative one (`//evil.example`),
// either of which is an open redirect if passed straight through.
export function getSafeRedirectTarget(raw: string | null, fallback = '/dashboard'): string {
  if (raw && raw.startsWith('/') && !raw.startsWith('//')) {
    return raw;
  }
  return fallback;
}
