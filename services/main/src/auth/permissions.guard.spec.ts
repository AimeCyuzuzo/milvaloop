import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { PermissionsGuard } from './permissions.guard';

function contextWithAuth(
  auth: { permissions: string[] } | undefined,
  required: string[] | undefined,
) {
  const reflector = {
    getAllAndOverride: () => required,
  } as unknown as Reflector;
  const context = {
    switchToHttp: () => ({ getRequest: () => ({ auth }) }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
  return { reflector, context };
}

describe('PermissionsGuard', () => {
  it('allows the request when the route requires no permissions', () => {
    const { reflector, context } = contextWithAuth(
      { permissions: [] },
      undefined,
    );
    expect(new PermissionsGuard(reflector).canActivate(context)).toBe(true);
  });

  it('allows the request when the route requires an empty permission list', () => {
    const { reflector, context } = contextWithAuth({ permissions: [] }, []);
    expect(new PermissionsGuard(reflector).canActivate(context)).toBe(true);
  });

  it('allows the request when the membership has every required permission', () => {
    const { reflector, context } = contextWithAuth(
      { permissions: ['tenant:admin', 'other'] },
      ['tenant:admin'],
    );
    expect(new PermissionsGuard(reflector).canActivate(context)).toBe(true);
  });

  it('denies the request when the membership is missing a required permission', () => {
    const { reflector, context } = contextWithAuth({ permissions: [] }, [
      'tenant:admin',
    ]);
    expect(() => new PermissionsGuard(reflector).canActivate(context)).toThrow(
      ForbiddenException,
    );
  });

  it('denies the request when it is missing even one of several required permissions', () => {
    const { reflector, context } = contextWithAuth(
      { permissions: ['tenant:admin'] },
      ['tenant:admin', 'other'],
    );
    expect(() => new PermissionsGuard(reflector).canActivate(context)).toThrow(
      ForbiddenException,
    );
  });

  it('denies by default when request.auth is missing entirely (no AccessTokenGuard ran)', () => {
    const { reflector, context } = contextWithAuth(undefined, ['tenant:admin']);
    expect(() => new PermissionsGuard(reflector).canActivate(context)).toThrow(
      ForbiddenException,
    );
  });
});
