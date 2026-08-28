import { INestApplication } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import {
  createTestDatabase,
  resetDatabase,
  type TestDatabase,
} from '@milvaloop/db/testing';
import type { AuthSession } from '@milvaloop/types';
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

function bodyAs<T>(response: request.Response): T {
  return response.body as T;
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

// Exercises /cooperatives (an already-authenticated user creating a new
// cooperative) and /auth/cooperatives/switch (moving between memberships
// they already hold) — both ordinary authenticated flows, unlike the
// ticket-based /auth/cooperatives/select and create-from-ticket covered in
// auth.e2e-spec.ts's "multi-cooperative login" block.
describe('Cooperatives (e2e)', () => {
  let app: INestApplication<App>;
  let testDb: TestDatabase;
  let sentEmails: ReturnType<typeof createFakeMailer>['sent'];

  // slugify('Ikimina Test') -> 'ikimina-test' — the tenant's slug is
  // generated from tenantName now, never client-supplied.
  const FOUNDER = {
    tenantName: 'Ikimina Test',
    name: 'Founder Person',
    email: 'founder@example.com',
    password: 'correct-horse-battery',
  };
  const FOUNDER_SLUG = 'ikimina-test';

  async function signupFounder() {
    return request(app.getHttpServer()).post('/auth/signup').send(FOUNDER);
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
  });

  beforeEach(async () => {
    await resetDatabase(testDb.db);
    sentEmails.length = 0;
  });

  afterAll(async () => {
    await app.close();
    await testDb.teardown();
  });

  describe('POST /cooperatives', () => {
    it('creates a tenant and a founding membership for the current user', async () => {
      const signup = await signupFounder();
      const { accessToken } = bodyAs<AuthSession>(signup);

      const response = await request(app.getHttpServer())
        .post('/cooperatives')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Second Coop' });

      expect(response.status).toBe(201);
      const session = bodyAs<AuthSession>(response);
      expect(session.tenant).toMatchObject({
        name: 'Second Coop',
        slug: 'second-coop',
      });
      expect(session.permissions).toEqual(['tenant:admin']);
      expect(session.cooperatives.map((c) => c.slug).sort()).toEqual([
        FOUNDER_SLUG,
        'second-coop',
      ]);
      expect(response.get('Set-Cookie')?.join(';')).toContain('refreshToken=');
    });

    it('auto-generates a disambiguated slug when the cooperative name collides with an existing one', async () => {
      const signup = await signupFounder();
      const { accessToken } = bodyAs<AuthSession>(signup);

      const response = await request(app.getHttpServer())
        .post('/cooperatives')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: FOUNDER.tenantName });

      expect(response.status).toBe(201);
      expect(bodyAs<AuthSession>(response).tenant.slug).toBe(
        `${FOUNDER_SLUG}-2`,
      );
    });

    it('rejects an unauthenticated request', async () => {
      const response = await request(app.getHttpServer())
        .post('/cooperatives')
        .send({ name: 'Nope' });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /cooperatives/slug-preview', () => {
    it('returns the slug a cooperative would get, without creating anything', async () => {
      const response = await request(app.getHttpServer()).get(
        '/cooperatives/slug-preview?name=Brand%20New%20Coop',
      );

      expect(response.status).toBe(200);
      expect(bodyAs<{ slug: string }>(response).slug).toBe('brand-new-coop');
    });

    it('disambiguates against an existing tenant with the same generated slug', async () => {
      await signupFounder();

      const response = await request(app.getHttpServer()).get(
        `/cooperatives/slug-preview?name=${encodeURIComponent(FOUNDER.tenantName)}`,
      );

      expect(response.status).toBe(200);
      expect(bodyAs<{ slug: string }>(response).slug).toBe(`${FOUNDER_SLUG}-2`);
    });

    it('rejects a missing name', async () => {
      const response = await request(app.getHttpServer()).get(
        '/cooperatives/slug-preview',
      );
      expect(response.status).toBe(400);
    });
  });

  describe('POST /auth/cooperatives/switch', () => {
    async function signupFounderWithSecondCooperative() {
      const signup = await signupFounder();
      const { accessToken } = bodyAs<AuthSession>(signup);
      const refreshCookie = extractRefreshCookie(signup);

      const secondCooperative = await request(app.getHttpServer())
        .post('/cooperatives')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Second Coop' });

      // Creating a cooperative rotates the session, so the original signup
      // refresh cookie is already revoked by this point — grab a fresh one
      // for the switch to revoke instead.
      const freshRefreshCookie = extractRefreshCookie(secondCooperative);
      const { accessToken: currentAccessToken } =
        bodyAs<AuthSession>(secondCooperative);

      return {
        originalRefreshCookie: refreshCookie,
        currentAccessToken,
        currentRefreshCookie: freshRefreshCookie,
        secondCooperative: bodyAs<AuthSession>(secondCooperative),
      };
    }

    it('switches to a cooperative the user already belongs to and revokes the prior session', async () => {
      const { currentAccessToken, currentRefreshCookie, secondCooperative } =
        await signupFounderWithSecondCooperative();

      const founderCooperative = secondCooperative.cooperatives.find(
        (c) => c.slug === FOUNDER_SLUG,
      );
      if (!founderCooperative) {
        throw new Error(
          'Founding cooperative not found in the cooperative list',
        );
      }

      const switchResponse = await request(app.getHttpServer())
        .post('/auth/cooperatives/switch')
        .set('Authorization', `Bearer ${currentAccessToken}`)
        .set('Cookie', currentRefreshCookie)
        .send({ cooperativeId: founderCooperative.id });

      expect(switchResponse.status).toBe(200);
      expect(bodyAs<AuthSession>(switchResponse).tenant.slug).toBe(
        FOUNDER_SLUG,
      );

      // The refresh cookie presented during the switch must not survive it.
      const refreshOldSession = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', currentRefreshCookie);
      expect(refreshOldSession.status).toBe(401);
    });

    it('rejects a cooperativeId the user does not belong to', async () => {
      const { currentAccessToken } = await signupFounderWithSecondCooperative();

      const response = await request(app.getHttpServer())
        .post('/auth/cooperatives/switch')
        .set('Authorization', `Bearer ${currentAccessToken}`)
        .send({ cooperativeId: '00000000-0000-4000-8000-000000000000' });

      expect(response.status).toBe(401);
    });

    it('rejects an unauthenticated request', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/cooperatives/switch')
        .send({ cooperativeId: '00000000-0000-4000-8000-000000000000' });

      expect(response.status).toBe(401);
    });
  });
});
