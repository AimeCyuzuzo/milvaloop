import { INestApplication } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { eq, schema } from '@milvaloop/db';
import {
  createTestDatabase,
  resetDatabase,
  type TestDatabase,
} from '@milvaloop/db/testing';
import type { AuthSession, MemberListResponse } from '@milvaloop/types';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { App } from 'supertest/types';

import { AuditLogService } from '../src/audit/audit-log.service';
import { AccessTokenGuard } from '../src/auth/auth.guard';
import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { PermissionsGuard } from '../src/auth/permissions.guard';
import { env } from '../src/config/env';
import { ContributionsController } from '../src/contributions/contributions.controller';
import { ContributionsService } from '../src/contributions/contributions.service';
import { MonthlyDigestService } from '../src/contributions/monthly-digest.service';
import { DATABASE_CONNECTION } from '../src/db/db.module';
import { MAILER } from '../src/email/mailer.module';
import { ExportService } from '../src/export/export.service';
import { MembersController } from '../src/members/members.controller';
import { MembersService } from '../src/members/members.service';
import { createFakeMailer } from './fakes/fake-mailer';

const { memberships } = schema;

function bodyAs<T>(response: request.Response): T {
  return response.body as T;
}

// The digest always reports on the month before "now" (see
// MonthlyDigestService.sendMonthlyDigests) — computed the same way here so
// tests don't need to mock the system clock.
function previousCalendarPeriod(): string {
  const now = new Date();
  const date = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
  );
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${date.getUTCFullYear()}-${month}-01`;
}

const SHARE_PRICE = 50_000;

describe('Monthly digest (e2e)', () => {
  let app: INestApplication<App>;
  let testDb: TestDatabase;
  let sentEmails: ReturnType<typeof createFakeMailer>['sent'];
  let digestService: MonthlyDigestService;

  const FOUNDER = {
    tenantName: 'Digest Test Coop',
    name: 'Founder Person',
    email: 'founder@example.com',
    password: 'correct-horse-battery',
  };

  async function signupFounder(overrides?: {
    email?: string;
    tenantName?: string;
  }): Promise<AuthSession> {
    const response = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ ...FOUNDER, ...overrides });
    return bodyAs<AuthSession>(response);
  }

  async function activeMembershipId(token: string): Promise<string> {
    const list = await request(app.getHttpServer())
      .get('/members')
      .set('Authorization', `Bearer ${token}`);
    const [member] = bodyAs<MemberListResponse>(list).members;
    if (member.status !== 'active') {
      throw new Error('Expected an active member');
    }
    return member.membershipId;
  }

  async function setSharePrice(
    token: string,
    amount: number,
    effectiveFrom: string,
  ) {
    return request(app.getHttpServer())
      .post('/contributions/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount, effectiveFrom });
  }

  // Same reasoning as contribution-reminders.e2e-spec.ts's backdateMembership
  // — a period before memberSince never counts toward that member's history.
  async function backdateMembership(membershipId: string, createdAt: Date) {
    await testDb.db
      .update(memberships)
      .set({ createdAt, memberSince: createdAt.toISOString().slice(0, 10) })
      .where(eq(memberships.id, membershipId));
  }

  async function pauseDigest(
    token: string,
    membershipId: string,
    paused: boolean,
  ) {
    return request(app.getHttpServer())
      .patch(`/members/${membershipId}/digest`)
      .set('Authorization', `Bearer ${token}`)
      .send({ paused });
  }

  beforeAll(async () => {
    testDb = await createTestDatabase(env.DATABASE_URL);
    const { mailer, sent } = createFakeMailer();
    sentEmails = sent;

    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({})],
      controllers: [AuthController, MembersController, ContributionsController],
      providers: [
        AuthService,
        AccessTokenGuard,
        PermissionsGuard,
        AuditLogService,
        MembersService,
        ContributionsService,
        MonthlyDigestService,
        ExportService,
        { provide: DATABASE_CONNECTION, useValue: testDb.db },
        { provide: MAILER, useValue: mailer },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
    digestService = moduleRef.get(MonthlyDigestService);
  });

  beforeEach(async () => {
    await resetDatabase(testDb.db);
    sentEmails.length = 0;
  });

  afterAll(async () => {
    await app.close();
    await testDb.teardown();
  });

  function clearSentEmails() {
    sentEmails.length = 0;
  }

  it("sends a digest for last month's period", async () => {
    const founder = await signupFounder();
    const founderMembershipId = await activeMembershipId(founder.accessToken);
    await backdateMembership(
      founderMembershipId,
      new Date(`${previousCalendarPeriod()}T00:00:00.000Z`),
    );
    await setSharePrice(founder.accessToken, SHARE_PRICE, previousCalendarPeriod());
    clearSentEmails();

    await digestService.sendMonthlyDigests();

    const digestEmails = sentEmails.filter((email) => email.to === FOUNDER.email);
    expect(digestEmails).toHaveLength(1);
    expect(digestEmails[0]?.subject).toContain('summary');

    const rows = await testDb.db.select().from(schema.monthlyDigests);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ period: previousCalendarPeriod() });
  });

  it('never sends the same digest twice', async () => {
    const founder = await signupFounder();
    const founderMembershipId = await activeMembershipId(founder.accessToken);
    await backdateMembership(
      founderMembershipId,
      new Date(`${previousCalendarPeriod()}T00:00:00.000Z`),
    );
    await setSharePrice(founder.accessToken, SHARE_PRICE, previousCalendarPeriod());
    clearSentEmails();

    await digestService.sendMonthlyDigests();
    await digestService.sendMonthlyDigests();

    const digestEmails = sentEmails.filter((email) => email.to === FOUNDER.email);
    expect(digestEmails).toHaveLength(1);
    const rows = await testDb.db.select().from(schema.monthlyDigests);
    expect(rows).toHaveLength(1);
  });

  it('excludes a member with the digest paused', async () => {
    const founder = await signupFounder();
    const founderMembershipId = await activeMembershipId(founder.accessToken);
    await backdateMembership(
      founderMembershipId,
      new Date(`${previousCalendarPeriod()}T00:00:00.000Z`),
    );
    await setSharePrice(founder.accessToken, SHARE_PRICE, previousCalendarPeriod());
    const pauseResponse = await pauseDigest(founder.accessToken, founderMembershipId, true);
    expect(pauseResponse.status).toBe(204);
    clearSentEmails();

    await digestService.sendMonthlyDigests();

    expect(sentEmails.filter((email) => email.to === FOUNDER.email)).toHaveLength(0);
    // Still recorded as sent — a paused member shouldn't cause the whole
    // tenant to be re-processed (and re-emailed to everyone else) forever.
    const rows = await testDb.db.select().from(schema.monthlyDigests);
    expect(rows).toHaveLength(1);
  });

  it('resumes the digest for a member who was paused', async () => {
    const founder = await signupFounder();
    const founderMembershipId = await activeMembershipId(founder.accessToken);
    await backdateMembership(
      founderMembershipId,
      new Date(`${previousCalendarPeriod()}T00:00:00.000Z`),
    );
    await setSharePrice(founder.accessToken, SHARE_PRICE, previousCalendarPeriod());
    await pauseDigest(founder.accessToken, founderMembershipId, true);

    const resumeResponse = await pauseDigest(founder.accessToken, founderMembershipId, false);
    expect(resumeResponse.status).toBe(204);
    clearSentEmails();

    await digestService.sendMonthlyDigests();

    expect(sentEmails.filter((email) => email.to === FOUNDER.email)).toHaveLength(1);
  });

  it("never mixes another tenant's members into a run", async () => {
    const founderA = await signupFounder();
    const founderAMembershipId = await activeMembershipId(founderA.accessToken);
    await backdateMembership(
      founderAMembershipId,
      new Date(`${previousCalendarPeriod()}T00:00:00.000Z`),
    );
    await setSharePrice(founderA.accessToken, SHARE_PRICE, previousCalendarPeriod());

    const founderB = await signupFounder({
      email: 'founder-b@example.com',
      tenantName: 'Digest Test Coop B',
    });
    const founderBMembershipId = await activeMembershipId(founderB.accessToken);
    await backdateMembership(
      founderBMembershipId,
      new Date(`${previousCalendarPeriod()}T00:00:00.000Z`),
    );
    await setSharePrice(founderB.accessToken, SHARE_PRICE, previousCalendarPeriod());
    clearSentEmails();

    await digestService.sendMonthlyDigests();

    expect(sentEmails.filter((email) => email.to === founderA.user.email)).toHaveLength(1);
    expect(sentEmails.filter((email) => email.to === founderB.user.email)).toHaveLength(1);
  });
});
