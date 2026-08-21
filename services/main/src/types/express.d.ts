import type { AccessTokenClaims } from '../auth/auth.guard';

declare module 'express' {
  interface Request {
    auth?: AccessTokenClaims;
  }
}

export {};
