import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import type { AccessTokenClaims } from './auth.guard';

// Only usable on a route behind AccessTokenGuard, which populates
// request.auth from the verified token's claims.
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AccessTokenClaims => {
    const request = ctx.switchToHttp().getRequest<Request>();
    if (!request.auth) {
      throw new Error(
        '@CurrentUser() used on a route without AccessTokenGuard',
      );
    }
    return request.auth;
  },
);
