import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { eq, schema, type Database } from '@milvaloop/db';
import { getTenantAccessState } from '@milvaloop/types';
import type { Request } from 'express';

import { env } from '../config/env';
import { DATABASE_CONNECTION } from '../db/db.module';

const { tenants } = schema;

export interface AccessTokenClaims {
  sub: string; // user id
  tenantId: string;
  email: string;
  permissions: string[];
}

// Requests that only read never get blocked by a locked tenant (see
// AuthService.issueSession's own comment — read access is exactly what's
// preserved for an admin logged into a locked tenant). HEAD/OPTIONS are
// included on the same reasoning as GET.
const READ_ONLY_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// The tenant id used to scope every subsequent query comes from here — the
// verified access token's claims — never from a client-supplied parameter
// (see MAIN.md's multi-tenancy invariant). Also where a locked tenant's
// writes are blocked tenant-wide: the access token's own permissions claim
// is never trusted for this check (it's baked in at issuance and a tenant
// can lock between issuances — see AuthService.issueSession), so this
// re-reads the tenant's current plan/expiry on every mutating request
// instead. TENANT_ADMIN is not an exception here — unlike PermissionsGuard,
// where it's a blanket override, a locked tenant blocks admins from
// writing too (see tenants.ts's premiumExpiresAt comment).
@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers.authorization;
    const token = header?.startsWith('Bearer ')
      ? header.slice('Bearer '.length)
      : undefined;

    if (!token) {
      throw new UnauthorizedException('Missing access token');
    }

    let claims: AccessTokenClaims;
    try {
      claims = await this.jwtService.verifyAsync<AccessTokenClaims>(token, {
        secret: env.JWT_ACCESS_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
    request.auth = claims;

    if (READ_ONLY_METHODS.has(request.method)) {
      return true;
    }

    const [tenant] = await this.db
      .select({
        plan: tenants.plan,
        premiumExpiresAt: tenants.premiumExpiresAt,
      })
      .from(tenants)
      .where(eq(tenants.id, claims.tenantId))
      .limit(1);
    const accessState = tenant
      ? getTenantAccessState({
          plan: tenant.plan,
          premiumExpiresAt: tenant.premiumExpiresAt?.toISOString() ?? null,
        })
      : { status: 'active' as const };
    if (accessState.status === 'locked') {
      throw new ForbiddenException(
        "This cooperative's Premium access has expired. You can still view existing data, but changes are blocked until an administrator renews it.",
      );
    }

    return true;
  }
}
