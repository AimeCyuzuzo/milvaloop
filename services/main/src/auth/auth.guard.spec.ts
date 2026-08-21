import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

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

describe('AccessTokenGuard', () => {
  const jwtService = new JwtService();
  const guard = new AccessTokenGuard(jwtService);

  it('rejects a request with no Authorization header', async () => {
    const context = contextWithRequest({ headers: {} });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a header that is not a Bearer token', async () => {
    const context = contextWithRequest({
      headers: { authorization: 'Basic abc123' },
    });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a token signed with a different secret', async () => {
    const token = await jwtService.signAsync(
      { sub: 'user-1' },
      { secret: 'wrong-secret-that-is-also-32-chars' },
    );
    const context = contextWithRequest({
      headers: { authorization: `Bearer ${token}` },
    });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects an expired token', async () => {
    const token = await jwtService.signAsync(
      { sub: 'user-1' },
      { secret: SECRET, expiresIn: -1 },
    );
    const context = contextWithRequest({
      headers: { authorization: `Bearer ${token}` },
    });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('accepts a validly signed token and attaches its claims to the request', async () => {
    const claims = {
      sub: 'user-1',
      tenantId: 'tenant-1',
      email: 'a@example.com',
      permissions: ['tenant:admin'],
    };
    const token = await jwtService.signAsync(claims, { secret: SECRET });
    const request = { headers: { authorization: `Bearer ${token}` } };
    const context = contextWithRequest(request);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    // @types/jest types `expect.objectContaining` as `any` — not a real
    // type-safety gap in this test, just that matcher's own typing.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    expect(request).toMatchObject({ auth: expect.objectContaining(claims) });
  });
});
