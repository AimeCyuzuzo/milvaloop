import type { Request, Response } from 'express';

import { env } from '../config/env';

export const REFRESH_COOKIE = 'refreshToken';

export function readRefreshCookie(req: Request): string | undefined {
  const cookies = req.cookies as Record<string, string> | undefined;
  return cookies?.[REFRESH_COOKIE];
}

export function setRefreshCookie(
  res: Response,
  token: string,
  expiresAt: Date,
): void {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    domain: env.COOKIE_DOMAIN,
    path: '/auth',
    expires: expiresAt,
  });
}
