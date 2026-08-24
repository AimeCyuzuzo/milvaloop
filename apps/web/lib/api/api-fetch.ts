import { env } from '../env';
import { getAccessToken, setAccessToken } from '../auth/token-store';

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

// For call sites that just need a message to show (a confirm-dialog action,
// a toast) rather than binding field-level errors onto a form — see
// apply-server-error.ts's applyServerError for that case instead.
export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const body = error.body as { message?: string } | null;
    if (body?.message) {
      return body.message;
    }
  }
  return 'Something went wrong. Please try again.';
}

export interface ApiFetchOptions extends RequestInit {
  /** Skip attaching the access token / attempting a refresh (e.g. login, refresh itself). */
  skipAuth?: boolean;
}

// Concurrent 401s must share a single refresh attempt rather than each
// firing their own — otherwise every in-flight request races to rotate the
// refresh token and only one would win.
let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const response = await fetch(`${env.NEXT_PUBLIC_API_URL}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });

        if (!response.ok) {
          setAccessToken(null);
          return false;
        }

        const data = (await response.json()) as { accessToken: string };
        setAccessToken(data.accessToken);
        return true;
      } catch {
        setAccessToken(null);
        return false;
      } finally {
        refreshPromise = null;
      }
    })();
  }

  return refreshPromise;
}

function buildRequest(path: string, options: ApiFetchOptions): Request {
  const { skipAuth, headers, ...rest } = options;
  const token = getAccessToken();

  return new Request(`${env.NEXT_PUBLIC_API_URL}${path}`, {
    ...rest,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token && !skipAuth ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });
}

/**
 * The only sanctioned way to call `services/main` from the browser. Never
 * call `fetch` directly for API requests — this is the single place that
 * attaches the access token and transparently refreshes it on a 401.
 */
export async function apiFetch<T = unknown>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  let response = await fetch(buildRequest(path, options));

  if (response.status === 401 && !options.skipAuth) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      response = await fetch(buildRequest(path, options));
    }
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(`${options.method ?? 'GET'} ${path} failed with ${response.status}`, response.status, body);
  }

  // Checked by content rather than only status === 204 — a 200/201 with
  // nothing written to the response body (e.g. a controller method that
  // returns void) parses to an empty string here too, and JSON.parse would
  // throw on it exactly the way a real error would, masking a request that
  // actually succeeded.
  const text = await response.text();
  if (!text) {
    return undefined as T;
  }
  return JSON.parse(text) as T;
}
