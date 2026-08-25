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
import { ContributionReminderService } from '../src/contributions/contribution-reminders.service';
import { ContributionsController } from '../src/contributions/contributions.controller';
import { ContributionsService } from '../src/contributions/contributions.service';
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

function currentPeriod(): string {
  const now = new Date();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${now.getUTCFullYear()}-${month}-01`;
}

// A period `count` months before the current one — used to put a member
// safely past both the due-soon and overdue thresholds without needing to
// mock the system clock (see contribution-reminders.service.ts's own
// thresholds: day 15 of the period's month for due-soon, day 7 of the
// *following* month for overdue — a period two real months in the past is
// always past both, on any day this test happens to run).
function monthsAgo(count: number): string {
  const now = new Date();
  const date = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - count, 1),
  );
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${date.getUTCFullYear()}-${month}-01`;
}

const SHARE_PRICE = 50_000;

describe('Contribution reminders (e2e)', () => {
  let app: INestApplication<App>;
  let testDb: TestDatabase;
  let sentEmails: ReturnType<typeof createFakeMailer>['sent'];
  let reminderService: ContributionReminderService;

  const FOUNDER = {
    tenantName: 'Reminders Test Coop',
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

  // getPeriodsThrough clamps its start to the *later* of (membership
  // joined, first share price) — a member never owes dues for a period
  // before they joined. A signup's membership is always created "now," so
  // testing an overdue period genuinely in the past means backdating the
  // membership itself, not just the share price — there's no product-level
  // way to do this (a membership's join date isn't editable), so this goes
  // straight at the test database.
  async function backdateMembership(membershipId: string, createdAt: Date) {
    await testDb.db
      .update(memberships)
      .set({ createdAt })
      .where(eq(memberships.id, membershipId));
  }

  async function pauseReminders(
    token: string,
    membershipId: string,
    paused: boolean,
  ) {
    return request(app.getHttpServer())
      .patch(`/members/${membershipId}/reminders`)
      .set('Authorization', `Bearer ${token}`)
      .send({ paused });
  }

  async function recordAndApprove(
    token: string,
    membershipId: string,
    amount: number,
    period: string,
  ) {
    await request(app.getHttpServer())
      .post('/contributions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        membershipId,
        amount,
        contributedAt: period,
        allocations: [{ period, amount }],
      });
    const list = await request(app.getHttpServer())
      .get('/contributions')
      .set('Authorization', `Bearer ${token}`);
    const contributions = bodyAs<{
      contributions: Array<{ id: string; status: string }>;
    }>(list).contributions;
    const pending = contributions.find(
      (contribution) => contribution.status === 'pending',
    );
    if (!pending) {
      throw new Error('Expected a pending contribution to approve');
    }
    await request(app.getHttpServer())
      .post(`/contributions/${pending.id}/approve`)
      .set('Authorization', `Bearer ${token}`);
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
        ContributionReminderService,
        ExportService,
        { provide: DATABASE_CONNECTION, useValue: testDb.db },
        { provide: MAILER, useValue: mailer },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
    reminderService = moduleRef.get(ContributionReminderService);
  });

  beforeEach(async () => {
    await resetDatabase(testDb.db);
    sentEmails.length = 0;
  });

  afterAll(async () => {
    await app.close();
    await testDb.teardown();
  });

  // Signup itself sends a verify-email message to the same address a
  // reminder would go to — cleared right before triggering the cron so
  // every assertion below is only counting reminder sends, not setup noise.
  function clearSentEmails() {
    sentEmails.length = 0;
  }

  it('sends a due-soon reminder for an untouched current period', async () => {
    const founder = await signupFounder();
    await setSharePrice(founder.accessToken, SHARE_PRICE, currentPeriod());
    clearSentEmails();

    await reminderService.sendDailyReminders();

    const reminderEmails = sentEmails.filter(
      (email) => email.to === FOUNDER.email,
    );
    expect(reminderEmails).toHaveLength(1);
    expect(reminderEmails[0]?.subject).toContain('reminder');

    const rows = await testDb.db.select().from(schema.contributionReminders);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      period: currentPeriod(),
      kind: 'due_soon',
    });
  });

  it('never sends the same trigger twice', async () => {
    const founder = await signupFounder();
    await setSharePrice(founder.accessToken, SHARE_PRICE, currentPeriod());
    clearSentEmails();

    await reminderService.sendDailyReminders();
    await reminderService.sendDailyReminders();

    const reminderEmails = sentEmails.filter(
      (email) => email.to === FOUNDER.email,
    );
    expect(reminderEmails).toHaveLength(1);
    const rows = await testDb.db.select().from(schema.contributionReminders);
    expect(rows).toHaveLength(1);
  });

  it('sends an overdue reminder for a period two months in the past', async () => {
    const founder = await signupFounder();
    const founderMembershipId = await activeMembershipId(founder.accessToken);
    await backdateMembership(
      founderMembershipId,
      new Date(`${monthsAgo(2)}T00:00:00.000Z`),
    );
    await setSharePrice(founder.accessToken, SHARE_PRICE, monthsAgo(2));
    clearSentEmails();

    await reminderService.sendDailyReminders();

    const rows = await testDb.db.select().from(schema.contributionReminders);
    const overdueRow = rows.find((row) => row.period === monthsAgo(2));
    expect(overdueRow).toMatchObject({ period: monthsAgo(2), kind: 'overdue' });

    const reminderEmails = sentEmails.filter(
      (email) => email.to === FOUNDER.email,
    );
    expect(reminderEmails).toHaveLength(1);
    expect(reminderEmails[0]?.text).toContain('months outstanding');
  });

  it('never reminds a member whose current period is already satisfied', async () => {
    const founder = await signupFounder();
    const founderMembershipId = await activeMembershipId(founder.accessToken);
    await setSharePrice(founder.accessToken, SHARE_PRICE, currentPeriod());
    await recordAndApprove(
      founder.accessToken,
      founderMembershipId,
      SHARE_PRICE,
      currentPeriod(),
    );
    clearSentEmails();

    await reminderService.sendDailyReminders();

    expect(
      sentEmails.filter((email) => email.to === FOUNDER.email),
    ).toHaveLength(0);
    const rows = await testDb.db.select().from(schema.contributionReminders);
    expect(rows).toHaveLength(0);
  });

  it('excludes a member with reminders paused', async () => {
    const founder = await signupFounder();
    const founderMembershipId = await activeMembershipId(founder.accessToken);
    await setSharePrice(founder.accessToken, SHARE_PRICE, currentPeriod());
    const pauseResponse = await pauseReminders(
      founder.accessToken,
      founderMembershipId,
      true,
    );
    expect(pauseResponse.status).toBe(204);
    clearSentEmails();

    await reminderService.sendDailyReminders();

    expect(
      sentEmails.filter((email) => email.to === FOUNDER.email),
    ).toHaveLength(0);
    const rows = await testDb.db.select().from(schema.contributionReminders);
    expect(rows).toHaveLength(0);
  });

  it('resumes reminders for a member who was paused', async () => {
    const founder = await signupFounder();
    const founderMembershipId = await activeMembershipId(founder.accessToken);
    await setSharePrice(founder.accessToken, SHARE_PRICE, currentPeriod());
    await pauseReminders(founder.accessToken, founderMembershipId, true);

    const resumeResponse = await pauseReminders(
      founder.accessToken,
      founderMembershipId,
      false,
    );
    expect(resumeResponse.status).toBe(204);
    clearSentEmails();

    await reminderService.sendDailyReminders();

    expect(
      sentEmails.filter((email) => email.to === FOUNDER.email),
    ).toHaveLength(1);
  });

  it("never mixes another tenant's members into a run", async () => {
    const founderA = await signupFounder();
    await setSharePrice(founderA.accessToken, SHARE_PRICE, currentPeriod());
    const founderB = await signupFounder({
      email: 'founder-b@example.com',
      tenantName: 'Reminders Test Coop B',
    });
    await setSharePrice(founderB.accessToken, SHARE_PRICE, currentPeriod());
    clearSentEmails();

    await reminderService.sendDailyReminders();

    expect(
      sentEmails.filter((email) => email.to === founderA.user.email),
    ).toHaveLength(1);
    expect(
      sentEmails.filter((email) => email.to === founderB.user.email),
    ).toHaveLength(1);
  });
});
