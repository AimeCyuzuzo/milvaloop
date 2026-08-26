import { INestApplication } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import {
  createTestDatabase,
  resetDatabase,
  type TestDatabase,
} from '@milvaloop/db/testing';
import { eq, schema } from '@milvaloop/db';
import type {
  AuthSession,
  CurrentSession,
  LoginResult,
} from '@milvaloop/types';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { App } from 'supertest/types';

import { AccessTokenGuard } from '../src/auth/auth.guard';
import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { CooperativesController } from '../src/cooperatives/cooperatives.controller';
import { env } from '../src/config/env';
import { DATABASE_CONNECTION } from '../src/db/db.module';
import { MAILER } from '../src/email/mailer.module';
import { createFakeMailer } from './fakes/fake-mailer';

interface ErrorMessageBody {
  message: string;
}

interface ValidationErrorBody {
  issues: { path: string[]; message: string }[];
}

// supertest types response.body as `any` — this is the one place that cast
// is contained, so every call site gets a real type instead of `any`.
function bodyAs<T>(response: request.Response): T {
  return response.body as T;
}

// Narrows a LoginResult down to its 'authenticated' branch, failing loudly
// if a test ever gets a challenge state it didn't expect.
function expectAuthenticated(response: request.Response): AuthSession {
  const result = bodyAs<LoginResult>(response);
  if (result.status !== 'authenticated') {
    throw new Error(
      `Expected an authenticated session, got status "${result.status}"`,
    );
  }
  return result;
}

// Exercises the real HTTP layer (guards, pipes, cookies, status codes) and
// real business logic (AuthService) against a real, ephemeral Postgres
// database — this is the automated version of the manual curl/Mailpit
// verification the auth module was built against. Deliberately excludes
// ThrottlerModule so rapid test cases don't trip rate limits meant for
// production abuse (see auth-rate-limit.e2e-spec.ts for that).
describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let testDb: TestDatabase;
  let jwtService: JwtService;
  let sentEmails: ReturnType<typeof createFakeMailer>['sent'];

  // slugify('Ikimina Test') -> 'ikimina-test' — the tenant's slug is
  // generated from tenantName now, never client-supplied.
  const FOUNDER = {
    tenantName: 'Ikimina Test',
    email: 'founder@example.com',
    password: 'correct-horse-battery',
  };
  const FOUNDER_SLUG = 'ikimina-test';

  async function signupFounder() {
    const response = await request(app.getHttpServer())
      .post('/auth/signup')
      .send(FOUNDER);
    return response;
  }

  // Shared by the multi-cooperative login tests and the removed-membership
  // tests below — both need a user who belongs to two cooperatives.
  async function signupFounderWithSecondCooperative() {
    const signup = await signupFounder();
    const { accessToken } = bodyAs<AuthSession>(signup);

    const secondCooperative = await request(app.getHttpServer())
      .post('/cooperatives')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Second Coop' });
    expect(secondCooperative.status).toBe(201);

    return { signup, accessToken };
  }

  function extractRefreshCookie(response: request.Response): string {
    const cookies = response.get('Set-Cookie');
    const refreshCookie = cookies?.find((cookie) =>
      cookie.startsWith('refreshToken='),
    );
    if (!refreshCookie) {
      throw new Error('No refreshToken cookie in response');
    }
    return refreshCookie.split(';')[0];
  }

  // Signup, magic-link, verification, and reset emails can all be in flight
  // at once — find the one that matters by subject rather than assuming
  // send order.
  function extractTokenFromEmail(subjectContains: string): string {
    const email = [...sentEmails]
      .reverse()
      .find((candidate) => candidate.subject?.includes(subjectContains));
    if (!email) {
      throw new Error(
        `No email with subject containing "${subjectContains}" was sent`,
      );
    }
    // The link's visible label is an action verb ("Sign in"), not the raw
    // URL, so the token only appears in the HTML anchor's href — not in the
    // plain-text body, which is what a real mail client's rendered view
    // (and a user clicking the button) actually follows.
    const match = /token=([a-f0-9]+)/.exec(email.html ?? '');
    if (!match) {
      throw new Error('No token found in email body');
    }
    return match[1];
  }

  beforeAll(async () => {
    testDb = await createTestDatabase(env.DATABASE_URL);

    const { mailer, sent } = createFakeMailer();
    sentEmails = sent;

    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({})],
      controllers: [AuthController, CooperativesController],
      providers: [
        AuthService,
        AccessTokenGuard,
        { provide: DATABASE_CONNECTION, useValue: testDb.db },
        { provide: MAILER, useValue: mailer },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
    jwtService = moduleRef.get(JwtService);
  });

  beforeEach(async () => {
    await resetDatabase(testDb.db);
    sentEmails.length = 0;
  });

  afterAll(async () => {
    await app.close();
    await testDb.teardown();
  });

  describe('POST /auth/signup', () => {
    it('creates a user, tenant, and founding membership, and sets the refresh cookie', async () => {
      const response = await signupFounder();

      expect(response.status).toBe(201);
      const session = bodyAs<AuthSession>(response);
      expect(typeof session.accessToken).toBe('string');
      expect(session).toMatchObject({
        user: { email: FOUNDER.email },
        tenant: { name: FOUNDER.tenantName, slug: FOUNDER_SLUG },
        permissions: ['tenant:admin'],
        cooperatives: [{ name: FOUNDER.tenantName, slug: FOUNDER_SLUG }],
      });

      const cookie = extractRefreshCookie(response);
      expect(cookie).toContain('refreshToken=');
      expect(response.get('Set-Cookie')?.join(';')).toMatch(/HttpOnly/);
      expect(response.get('Set-Cookie')?.join(';')).toMatch(/Path=\/auth/);
    });

    it('auto-generates a disambiguated slug when the tenant name collides with an existing one', async () => {
      await signupFounder();

      const response = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({ ...FOUNDER, email: 'someone-else@example.com' });

      expect(response.status).toBe(201);
      expect(bodyAs<AuthSession>(response).tenant.slug).toBe(
        `${FOUNDER_SLUG}-2`,
      );
    });

    it('rejects a duplicate email with 409', async () => {
      await signupFounder();

      const response = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({ ...FOUNDER, tenantName: 'A Different Coop' });

      expect(response.status).toBe(409);
    });

    it('skips a reserved word when the generated slug would collide with one, and still succeeds', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({
          ...FOUNDER,
          tenantName: 'Admin',
          email: 'admin-founder@example.com',
        });

      expect(response.status).toBe(201);
      expect(bodyAs<AuthSession>(response).tenant.slug).toBe('admin-2');
    });

    it('rejects an empty tenant name with 400', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({ ...FOUNDER, tenantName: '' });

      expect(response.status).toBe(400);
      const { issues } = bodyAs<ValidationErrorBody>(response);
      expect(issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: ['tenantName'] }),
        ]),
      );
    });
  });

  describe('POST /auth/login', () => {
    it('logs in with the correct credentials and goes straight in when there is exactly one cooperative', async () => {
      await signupFounder();

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: FOUNDER.email, password: FOUNDER.password });

      expect(response.status).toBe(200);
      expect(expectAuthenticated(response).user.email).toBe(FOUNDER.email);
    });

    it('rejects the wrong password with a generic message', async () => {
      await signupFounder();

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: FOUNDER.email, password: 'wrong-password' });

      expect(response.status).toBe(401);
      expect(bodyAs<ErrorMessageBody>(response).message).toBe(
        'Invalid email or password',
      );
    });

    it('rejects an unknown email with the same generic message (no enumeration)', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'nobody@example.com', password: FOUNDER.password });

      expect(response.status).toBe(401);
      expect(bodyAs<ErrorMessageBody>(response).message).toBe(
        'Invalid email or password',
      );
    });
  });

  describe('GET /auth/me', () => {
    it('returns the current session for a valid access token', async () => {
      const signup = await signupFounder();
      const { accessToken } = bodyAs<AuthSession>(signup);

      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(bodyAs<CurrentSession>(response)).toMatchObject({
        user: { email: FOUNDER.email },
        permissions: ['tenant:admin'],
      });
    });

    it('rejects a request with no access token', async () => {
      const response = await request(app.getHttpServer()).get('/auth/me');
      expect(response.status).toBe(401);
    });
  });

  describe('POST /auth/refresh', () => {
    it('rotates the refresh token on the happy path', async () => {
      const signup = await signupFounder();
      const firstCookie = extractRefreshCookie(signup);

      const firstRefresh = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', firstCookie);
      expect(firstRefresh.status).toBe(200);
      const secondCookie = extractRefreshCookie(firstRefresh);

      const secondRefresh = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', secondCookie);
      expect(secondRefresh.status).toBe(200);
    });

    it('detects reuse of an already-rotated token and revokes every session for that user', async () => {
      const signup = await signupFounder();
      const firstCookie = extractRefreshCookie(signup);

      const firstRefresh = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', firstCookie);
      const secondCookie = extractRefreshCookie(firstRefresh);

      // Replay the already-rotated cookie — this should fail...
      const replay = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', firstCookie);
      expect(replay.status).toBe(401);

      // ...and the legitimately-rotated session should now be dead too.
      const afterReplay = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', secondCookie);
      expect(afterReplay.status).toBe(401);
    });

    it('rejects a request with no refresh cookie', async () => {
      const response = await request(app.getHttpServer()).post('/auth/refresh');
      expect(response.status).toBe(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('revokes the session so a subsequent refresh fails', async () => {
      const signup = await signupFounder();
      const cookie = extractRefreshCookie(signup);

      const logout = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Cookie', cookie);
      expect(logout.status).toBe(204);

      const refreshAfterLogout = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', cookie);
      expect(refreshAfterLogout.status).toBe(401);
    });
  });

  describe('magic link', () => {
    it('sends an identical response whether or not the account exists', async () => {
      await signupFounder();
      sentEmails.length = 0; // signup already sent a verification email

      const forExisting = await request(app.getHttpServer())
        .post('/auth/magic-link/request')
        .send({ email: FOUNDER.email });
      const forMissing = await request(app.getHttpServer())
        .post('/auth/magic-link/request')
        .send({ email: 'nobody@example.com' });

      expect(forExisting.status).toBe(forMissing.status);
      expect(forExisting.body).toEqual(forMissing.body);
      expect(sentEmails).toHaveLength(1); // only the real account got an email
    });

    it('does not send a second email within the cooldown window', async () => {
      await signupFounder();
      sentEmails.length = 0; // signup already sent a verification email

      await request(app.getHttpServer())
        .post('/auth/magic-link/request')
        .send({ email: FOUNDER.email });
      await request(app.getHttpServer())
        .post('/auth/magic-link/request')
        .send({ email: FOUNDER.email });

      expect(sentEmails).toHaveLength(1);
    });

    it('consumes a real token from the sent email and logs in, single-use enforced', async () => {
      await signupFounder();
      await request(app.getHttpServer())
        .post('/auth/magic-link/request')
        .send({ email: FOUNDER.email });

      const token = extractTokenFromEmail('Sign in to');

      const firstConsume = await request(app.getHttpServer())
        .post('/auth/magic-link/consume')
        .send({ token });
      expect(firstConsume.status).toBe(200);
      expect(expectAuthenticated(firstConsume).user.email).toBe(FOUNDER.email);

      const secondConsume = await request(app.getHttpServer())
        .post('/auth/magic-link/consume')
        .send({ token });
      expect(secondConsume.status).toBe(401);
    });

    it('rejects a made-up token', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/magic-link/consume')
        .send({ token: 'not-a-real-token' });
      expect(response.status).toBe(401);
    });
  });

  describe('email verification', () => {
    it('sends a verification email on signup', async () => {
      await signupFounder();
      expect(
        sentEmails.some((email) =>
          email.subject?.includes('Verify your email'),
        ),
      ).toBe(true);
    });

    it('marks the email verified when a real token is consumed, single-use enforced', async () => {
      const signup = await signupFounder();
      expect(bodyAs<AuthSession>(signup).user.emailVerified).toBe(false);

      const token = extractTokenFromEmail('Verify your email');
      const firstVerify = await request(app.getHttpServer())
        .post('/auth/email/verify')
        .send({ token });
      expect(firstVerify.status).toBe(200);

      const { accessToken } = bodyAs<AuthSession>(signup);
      const me = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(bodyAs<CurrentSession>(me).user.emailVerified).toBe(true);

      const secondVerify = await request(app.getHttpServer())
        .post('/auth/email/verify')
        .send({ token });
      expect(secondVerify.status).toBe(401);
    });

    it('rejects a made-up token', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/email/verify')
        .send({ token: 'not-real' });
      expect(response.status).toBe(401);
    });

    describe('resend', () => {
      it('requires authentication', async () => {
        const response = await request(app.getHttpServer()).post(
          '/auth/email/resend',
        );
        expect(response.status).toBe(401);
      });

      it('does nothing within the cooldown window from the signup email', async () => {
        const signup = await signupFounder();
        const { accessToken } = bodyAs<AuthSession>(signup);
        sentEmails.length = 0;

        await request(app.getHttpServer())
          .post('/auth/email/resend')
          .set('Authorization', `Bearer ${accessToken}`);

        expect(sentEmails).toHaveLength(0);
      });

      it('does nothing once the email is already verified', async () => {
        const signup = await signupFounder();
        const { accessToken } = bodyAs<AuthSession>(signup);
        const token = extractTokenFromEmail('Verify your email');
        await request(app.getHttpServer())
          .post('/auth/email/verify')
          .send({ token });
        sentEmails.length = 0;

        await request(app.getHttpServer())
          .post('/auth/email/resend')
          .set('Authorization', `Bearer ${accessToken}`);

        expect(sentEmails).toHaveLength(0);
      });
    });
  });

  describe('password forgot/reset', () => {
    it('sends an identical response whether or not the account exists', async () => {
      await signupFounder();
      sentEmails.length = 0;

      const forExisting = await request(app.getHttpServer())
        .post('/auth/password/forgot')
        .send({ email: FOUNDER.email });
      const forMissing = await request(app.getHttpServer())
        .post('/auth/password/forgot')
        .send({ email: 'nobody@example.com' });

      expect(forExisting.status).toBe(forMissing.status);
      expect(forExisting.body).toEqual(forMissing.body);
      expect(sentEmails).toHaveLength(1);
    });

    it('does not send a second email within the cooldown window', async () => {
      await signupFounder();
      sentEmails.length = 0;

      await request(app.getHttpServer())
        .post('/auth/password/forgot')
        .send({ email: FOUNDER.email });
      await request(app.getHttpServer())
        .post('/auth/password/forgot')
        .send({ email: FOUNDER.email });

      expect(sentEmails).toHaveLength(1);
    });

    it('resets the password without issuing a session, revokes existing sessions, and enforces single use', async () => {
      const signup = await signupFounder();
      const oldRefreshCookie = extractRefreshCookie(signup);

      await request(app.getHttpServer())
        .post('/auth/password/forgot')
        .send({ email: FOUNDER.email });
      const token = extractTokenFromEmail('Reset your');

      const reset = await request(app.getHttpServer())
        .post('/auth/password/reset')
        .send({ token, newPassword: 'a-brand-new-password' });
      expect(reset.status).toBe(200);
      expect(bodyAs<ErrorMessageBody>(reset).message).toBe(
        'Password changed. Please log in with your new password.',
      );
      expect(reset.get('Set-Cookie')).toBeUndefined();

      // The session that existed before the reset must not survive it.
      const refreshOldSession = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', oldRefreshCookie);
      expect(refreshOldSession.status).toBe(401);

      const loginOldPassword = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: FOUNDER.email, password: FOUNDER.password });
      expect(loginOldPassword.status).toBe(401);

      const loginNewPassword = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: FOUNDER.email, password: 'a-brand-new-password' });
      expect(loginNewPassword.status).toBe(200);
      expect(expectAuthenticated(loginNewPassword).user.email).toBe(
        FOUNDER.email,
      );

      const reuse = await request(app.getHttpServer())
        .post('/auth/password/reset')
        .send({ token, newPassword: 'yet-another-password' });
      expect(reuse.status).toBe(401);
    });

    it('rejects a made-up token', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/password/reset')
        .send({ token: 'not-real', newPassword: 'a-brand-new-password' });
      expect(response.status).toBe(401);
    });
  });

  describe('POST /auth/password/change', () => {
    it('requires authentication', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/password/change')
        .send({
          currentPassword: FOUNDER.password,
          newPassword: 'a-brand-new-password',
        });
      expect(response.status).toBe(401);
    });

    it('rejects the wrong current password', async () => {
      const signup = await signupFounder();
      const { accessToken } = bodyAs<AuthSession>(signup);

      const response = await request(app.getHttpServer())
        .post('/auth/password/change')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'wrong-password',
          newPassword: 'a-brand-new-password',
        });

      expect(response.status).toBe(401);
    });

    it('changes the password and revokes existing sessions', async () => {
      const signup = await signupFounder();
      const { accessToken } = bodyAs<AuthSession>(signup);
      const oldRefreshCookie = extractRefreshCookie(signup);

      const response = await request(app.getHttpServer())
        .post('/auth/password/change')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: FOUNDER.password,
          newPassword: 'a-brand-new-password',
        });
      expect(response.status).toBe(200);

      const refreshOldSession = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', oldRefreshCookie);
      expect(refreshOldSession.status).toBe(401);

      const loginNewPassword = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: FOUNDER.email, password: 'a-brand-new-password' });
      expect(loginNewPassword.status).toBe(200);
    });
  });

  describe('multi-cooperative login', () => {
    it('offers a picker when the user belongs to more than one cooperative', async () => {
      await signupFounderWithSecondCooperative();

      const login = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: FOUNDER.email, password: FOUNDER.password });

      expect(login.status).toBe(200);
      const result = bodyAs<LoginResult>(login);
      if (result.status !== 'selection_required') {
        throw new Error(`Expected selection_required, got "${result.status}"`);
      }
      expect(result.cooperatives).toHaveLength(2);
      expect(result.cooperatives.map((c) => c.slug).sort()).toEqual([
        'ikimina-test',
        'second-coop',
      ]);
    });

    it('finishes the login when a valid ticket selects a cooperative the user belongs to', async () => {
      await signupFounderWithSecondCooperative();

      const login = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: FOUNDER.email, password: FOUNDER.password });
      const result = bodyAs<LoginResult>(login);
      if (result.status !== 'selection_required') {
        throw new Error(`Expected selection_required, got "${result.status}"`);
      }

      const secondCoop = result.cooperatives.find(
        (c) => c.slug === 'second-coop',
      );
      if (!secondCoop) {
        throw new Error('second-coop not found in the cooperative list');
      }

      const select = await request(app.getHttpServer())
        .post('/auth/cooperatives/select')
        .send({ ticket: result.ticket, cooperativeId: secondCoop.id });

      expect(select.status).toBe(200);
      expect(bodyAs<AuthSession>(select).tenant.slug).toBe('second-coop');
      expect(select.get('Set-Cookie')?.join(';')).toContain('refreshToken=');
    });

    it('rejects a cooperativeId the ticket holder does not belong to', async () => {
      await signupFounderWithSecondCooperative();

      const login = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: FOUNDER.email, password: FOUNDER.password });
      const result = bodyAs<LoginResult>(login);
      if (result.status !== 'selection_required') {
        throw new Error(`Expected selection_required, got "${result.status}"`);
      }

      // A membership id for someone else entirely — a random, well-formed
      // UUID the ticket-holder has no membership for.
      const select = await request(app.getHttpServer())
        .post('/auth/cooperatives/select')
        .send({
          ticket: result.ticket,
          cooperativeId: '00000000-0000-4000-8000-000000000000',
        });

      expect(select.status).toBe(401);
    });

    it('rejects a ticket signed with the wrong purpose', async () => {
      await signupFounderWithSecondCooperative();
      const login = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: FOUNDER.email, password: FOUNDER.password });
      const result = bodyAs<LoginResult>(login);
      if (result.status !== 'selection_required') {
        throw new Error(`Expected selection_required, got "${result.status}"`);
      }

      const wrongPurposeTicket = await jwtService.signAsync(
        { sub: result.cooperatives[0].id, purpose: 'not-a-login-ticket' },
        { secret: env.AUTH_TICKET_SECRET, expiresIn: '5m' },
      );

      const select = await request(app.getHttpServer())
        .post('/auth/cooperatives/select')
        .send({
          ticket: wrongPurposeTicket,
          cooperativeId: result.cooperatives[0].id,
        });

      expect(select.status).toBe(401);
    });

    it('rejects a ticket signed with the wrong secret (tampered)', async () => {
      await signupFounderWithSecondCooperative();
      const login = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: FOUNDER.email, password: FOUNDER.password });
      const result = bodyAs<LoginResult>(login);
      if (result.status !== 'selection_required') {
        throw new Error(`Expected selection_required, got "${result.status}"`);
      }

      const tamperedTicket = await jwtService.signAsync(
        { sub: result.cooperatives[0].id, purpose: 'login-ticket' },
        {
          secret: 'a-completely-different-secret-not-configured',
          expiresIn: '5m',
        },
      );

      const select = await request(app.getHttpServer())
        .post('/auth/cooperatives/select')
        .send({
          ticket: tamperedTicket,
          cooperativeId: result.cooperatives[0].id,
        });

      expect(select.status).toBe(401);
    });

    it('offers to create a first cooperative when the user has none, and finishes login on creation', async () => {
      const signup = await signupFounder();
      const { user } = bodyAs<AuthSession>(signup);

      // Simulate being removed from the only cooperative held (see MAIN.md's
      // "zero membership can happen" confirmation).
      await testDb.db
        .delete(schema.memberships)
        .where(eq(schema.memberships.userId, user.id));

      const login = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: FOUNDER.email, password: FOUNDER.password });

      expect(login.status).toBe(200);
      const result = bodyAs<LoginResult>(login);
      if (result.status !== 'no_cooperatives') {
        throw new Error(`Expected no_cooperatives, got "${result.status}"`);
      }

      const create = await request(app.getHttpServer())
        .post('/auth/cooperatives/create-from-ticket')
        .send({ ticket: result.ticket, name: 'Fresh Start' });

      expect(create.status).toBe(200);
      const created = bodyAs<AuthSession>(create);
      expect(created.tenant.slug).toBe('fresh-start');
      expect(created.permissions).toEqual(['tenant:admin']);
      expect(create.get('Set-Cookie')?.join(';')).toContain('refreshToken=');
    });
  });

  describe('a removed membership', () => {
    // Simulates removal directly against the database, the same effect
    // MembersService.remove has — this file has no MembersController
    // wired in, and the removedAt enforcement being tested here lives
    // entirely in AuthService, not in how the removal itself happened.
    async function removeMembership(tenantId: string): Promise<void> {
      await testDb.db
        .update(schema.memberships)
        .set({ removedAt: new Date() })
        .where(eq(schema.memberships.tenantId, tenantId));
    }

    it('cannot log in once their only membership is removed', async () => {
      const signup = await signupFounder();
      const { tenant } = bodyAs<AuthSession>(signup);
      await removeMembership(tenant.id);

      const login = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: FOUNDER.email, password: FOUNDER.password });

      expect(login.status).toBe(200);
      const result = bodyAs<LoginResult>(login);
      // Their password is still correct and their account still exists —
      // they just have no active membership anywhere, same response a
      // brand-new user with no cooperative yet would get.
      expect(result.status).toBe('no_cooperatives');
    });

    it('drops out of the cooperative picker once removed, and cannot be selected', async () => {
      const { signup } = await signupFounderWithSecondCooperative();
      const { tenant: removedTenant } = bodyAs<AuthSession>(signup);
      await removeMembership(removedTenant.id);

      const login = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: FOUNDER.email, password: FOUNDER.password });
      const result = bodyAs<LoginResult>(login);
      if (result.status !== 'authenticated') {
        // Only one active cooperative remains, so login finishes outright
        // rather than offering a picker with just one entry.
        throw new Error(`Expected authenticated, got "${result.status}"`);
      }
      expect(result.tenant.slug).toBe('second-coop');
    });

    it("can't refresh a session for a membership removed after it was issued", async () => {
      const signup = await signupFounder();
      const { tenant } = bodyAs<AuthSession>(signup);
      const refreshCookie = extractRefreshCookie(signup);

      await removeMembership(tenant.id);

      const refresh = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', refreshCookie);

      expect(refresh.status).toBe(401);
    });

    it('ends GET /auth/me for a membership removed after it was issued', async () => {
      const signup = await signupFounder();
      const { accessToken, tenant } = bodyAs<AuthSession>(signup);

      await removeMembership(tenant.id);

      const me = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(me.status).toBe(401);
    });
  });
});
