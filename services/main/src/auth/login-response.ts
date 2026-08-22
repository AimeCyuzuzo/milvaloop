import type { LoginResult } from '@milvaloop/types';
import type { Response } from 'express';

import type { LoginOutcome } from './auth.service';
import { setRefreshCookie } from './refresh-cookie';

// Shapes a LoginOutcome (this service layer's internal result) into the
// wire-shaped LoginResult, setting the refresh cookie on the 'authenticated'
// branch. Shared by AuthController (login, magic-link/consume, ...) and
// MembersController (accept-invite finishes exactly the same way once the
// new membership exists — see AuthService.finishLogin).
//
// selection_required/no_cooperatives aren't error states — the request
// succeeded and produced a legitimate next step, so both stay 200 OK with a
// discriminant the frontend branches on, same as an authenticated result.
export function toLoginResponse(
  outcome: LoginOutcome,
  res: Response,
): LoginResult {
  if (outcome.status === 'authenticated') {
    setRefreshCookie(
      res,
      outcome.issued.refreshToken,
      outcome.issued.refreshTokenExpiresAt,
    );
    return { status: 'authenticated', ...outcome.issued.session };
  }
  return outcome;
}
