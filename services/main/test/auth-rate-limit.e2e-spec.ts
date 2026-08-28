import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { Test } from '@nestjs/testing';
import { createTestDatabase, type TestDatabase } from '@milvaloop/db/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { App } from 'supertest/types';

import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { env } from '../src/config/env';
import { DATABASE_CONNECTION } from '../src/db/db.module';
import { MAILER } from '../src/email/mailer.module';
import { createFakeMailer } from './fakes/fake-mailer';

// Proves @Throttle(...) on AuthController is actually wired to a working
// guard — deliberately separate from auth.e2e-spec.ts, which excludes
// throttling so its many fast requests don't trip production-sized limits.
// Signup has the tightest limit of any auth route (5/hour, see
// AuthController), so it needs the fewest requests to prove the mechanism.
describe('Auth rate limiting (e2e)', () => {
  let app: INestApplication<App>;
  let testDb: TestDatabase;

  beforeAll(async () => {
    testDb = await createTestDatabase(env.DATABASE_URL);
    const { mailer } = createFakeMailer();

    const moduleRef = await Test.createTestingModule({
      imports: [
        JwtModule.register({}),
        ThrottlerModule.forRoot([
          { name: 'default', ttl: 3_600_000, limit: 100 },
        ]),
      ],
      controllers: [AuthController],
      providers: [
        AuthService,
        { provide: DATABASE_CONNECTION, useValue: testDb.db },
        { provide: MAILER, useValue: mailer },
        { provide: APP_GUARD, useClass: ThrottlerGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await testDb.teardown();
  });

  it('allows 5 signups from the same IP, then rejects the 6th with 429', async () => {
    for (let i = 0; i < 5; i++) {
      const response = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({
          tenantName: `Rate Limit Coop ${i}`,
          name: 'Founder Person',
          email: `founder-${i}@example.com`,
          password: 'correct-horse-battery',
        });
      expect(response.status).toBe(201);
    }

    const sixth = await request(app.getHttpServer()).post('/auth/signup').send({
      tenantName: 'Rate Limit Coop 6',
      name: 'Founder Person',
      email: 'founder-6@example.com',
      password: 'correct-horse-battery',
    });

    expect(sixth.status).toBe(429);
  });
});
