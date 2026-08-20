import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { PERMISSIONS_KEY } from './require-permissions.decorator';

// Checks the current membership's permissions (see MAIN.md's least-privilege
// rule) against whatever @RequirePermissions(...) declares on the route.
// Must run after AccessTokenGuard, which populates request.auth — a route
// with @RequirePermissions() but no AccessTokenGuard has nothing to check
// and is denied by default rather than silently allowed.
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[] | undefined>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const granted = request.auth?.permissions ?? [];
    const hasAll = required.every((permission) => granted.includes(permission));

    if (!hasAll) {
      throw new ForbiddenException(
        'You do not have permission to perform this action',
      );
    }

    return true;
  }
}
