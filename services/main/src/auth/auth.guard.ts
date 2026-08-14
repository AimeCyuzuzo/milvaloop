import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

import { env } from '../config/env';

export interface AccessTokenClaims {
  sub: string; // user id
  tenantId: string;
  email: string;
  permissions: string[];
}

// The tenant id used to scope every subsequent query comes from here — the
// verified access token's claims — never from a client-supplied parameter
// (see MAIN.md's multi-tenancy invariant).
@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers.authorization;
    const token = header?.startsWith('Bearer ')
      ? header.slice('Bearer '.length)
      : undefined;

    if (!token) {
      throw new UnauthorizedException('Missing access token');
    }

    try {
      request.auth = await this.jwtService.verifyAsync<AccessTokenClaims>(
        token,
        {
          secret: env.JWT_ACCESS_SECRET,
        },
      );
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    return true;
  }
}
