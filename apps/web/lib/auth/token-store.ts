// Access tokens are kept in memory only (never localStorage) — the refresh
// token that can mint new ones lives in an httpOnly cookie the browser
// manages on its own. Losing this on a hard refresh is expected: apiFetch
// transparently refreshes on the first 401.
let accessToken: string | null = null;

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(token: string | null) {
  accessToken = token;
}
