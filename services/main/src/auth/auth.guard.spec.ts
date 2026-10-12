import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Database } from '@milvaloop/db';

import { env } from '../config/env';
import { AccessTokenGuard } from './auth.guard';

// env.JWT_ACCESS_SECRET is read once at module-import time (see
// config/env.ts) — it can't be swapped per-test via process.env, so tests
// sign against the real value the guard will actually verify against.
const SECRET = env.JWT_ACCESS_SECRET;

function contextWithRequest(
  request: Record<string, unknown>,
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

// Only ever reached for a mutating request (the guard returns before this
// for GET/HEAD/OPTIONS) — a minimal stand-in for the one chained
// select/from/where/limit the guard actually calls, not a full Database.
function fakeDb(
  tenantRow: { plan: string; premiumExpiresAt: Date | null } | null,
): Database {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(tenantRow ? [tenantRow] : []),
        }),
      }),
    }),
  } as unknown as Database;
}

const jwtService = new JwtService();

async function signToken(
  claims: Record<string, unknown>,
  overrides?: { secret?: string; expiresIn?: number },
) {
  const options: { secret: string; expiresIn?: number } = {
    secret: overrides?.secret ?? SECRET,
  };
  if (overrides?.expiresIn !== undefined) {
    options.expiresIn = overrides.expiresIn;
  }
  return jwtService.signAsync(claims, options);
}

describe('AccessTokenGuard', () => {
  it('rejects a request with no Authorization header', async () => {
    const guard = new AccessTokenGuard(jwtService, fakeDb(null));
    const context = contextWithRequest({ method: 'GET', headers: {} });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a header that is not a Bearer token', async () => {
    const guard = new AccessTokenGuard(jwtService, fakeDb(null));
    const context = contextWithRequest({
      method: 'GET',
      headers: { authorization: 'Basic abc123' },
    });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a token signed with a different secret', async () => {
    const guard = new AccessTokenGuard(jwtService, fakeDb(null));
    const token = await signToken(
      { sub: 'user-1' },
      { secret: 'wrong-secret-that-is-also-32-chars' },
    );
    const context = contextWithRequest({
      method: 'GET',
      headers: { authorization: `Bearer ${token}` },
    });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects an expired token', async () => {
    const guard = new AccessTokenGuard(jwtService, fakeDb(null));
    const token = await signToken({ sub: 'user-1' }, { expiresIn: -1 });
    const context = contextWithRequest({
      method: 'GET',
      headers: { authorization: `Bearer ${token}` },
    });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('accepts a validly signed token and attaches its claims to the request', async () => {
    const guard = new AccessTokenGuard(jwtService, fakeDb(null));
    const claims = {
      sub: 'user-1',
      tenantId: 'tenant-1',
      email: 'a@example.com',
      permissions: ['tenant:admin'],
    };
    const token = await signToken(claims);
    const request = {
      method: 'GET',
      headers: { authorization: `Bearer ${token}` },
    };
    const context = contextWithRequest(request);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    // @types/jest types `expect.objectContaining` as `any` — not a real
    // type-safety gap in this test, just that matcher's own typing.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    expect(request).toMatchObject({ auth: expect.objectContaining(claims) });
  });

  it('allows a read request through without checking the tenant at all', async () => {
    // fakeDb(null) would otherwise report "tenant not found" — proves this
    // path never even looks, since GET is never blocked regardless.
    const guard = new AccessTokenGuard(jwtService, fakeDb(null));
    const token = await signToken({
      sub: 'user-1',
      tenantId: 'tenant-1',
      permissions: [],
    });
    const context = contextWithRequest({
      method: 'GET',
      headers: { authorization: `Bearer ${token}` },
    });
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('allows a mutating request when the tenant is active', async () => {
    const guard = new AccessTokenGuard(
      jwtService,
      fakeDb({ plan: 'free', premiumExpiresAt: null }),
    );
    const token = await signToken({
      sub: 'user-1',
      tenantId: 'tenant-1',
      permissions: [],
    });
    const context = contextWithRequest({
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
    });
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('blocks a mutating request once the tenant is locked', async () => {
    const expired = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const guard = new AccessTokenGuard(
      jwtService,
      fakeDb({ plan: 'premium', premiumExpiresAt: expired }),
    );
    const token = await signToken({
      sub: 'user-1',
      tenantId: 'tenant-1',
      permissions: [],
    });
    const context = contextWithRequest({
      method: 'PATCH',
      headers: { authorization: `Bearer ${token}` },
    });
    await expect(guard.canActivate(context)).rejects.toThrow(
      /Premium access has expired/,
    );
  });

  it("blocks a locked tenant's mutating request even for an admin", async () => {
    // Unlike PermissionsGuard, TENANT_ADMIN is not a bypass here (see
    // auth.guard.ts's own comment) — a locked tenant blocks writes for
    // everyone, admins included.
    const expired = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const guard = new AccessTokenGuard(
      jwtService,
      fakeDb({ plan: 'premium', premiumExpiresAt: expired }),
    );
    const token = await signToken({
      sub: 'user-1',
      tenantId: 'tenant-1',
      permissions: ['tenant:admin'],
    });
    const context = contextWithRequest({
      method: 'DELETE',
      headers: { authorization: `Bearer ${token}` },
    });
    await expect(guard.canActivate(context)).rejects.toThrow(
      /Premium access has expired/,
    );
  });
});
