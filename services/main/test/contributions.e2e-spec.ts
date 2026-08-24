import { INestApplication } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import {
  createTestDatabase,
  resetDatabase,
  type TestDatabase,
} from '@milvaloop/db/testing';
import type {
  AuthSession,
  MemberContributionSummary,
  MemberListResponse,
  ShareSettingsResponse,
} from '@milvaloop/types';
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
import { DATABASE_CONNECTION } from '../src/db/db.module';
import { MAILER } from '../src/email/mailer.module';
import { MembersController } from '../src/members/members.controller';
import { MembersService } from '../src/members/members.service';
import { createFakeMailer } from './fakes/fake-mailer';

function bodyAs<T>(response: request.Response): T {
  return response.body as T;
}

// A period is the first day of the current calendar month — the same
// truncation ContributionsService uses. Duplicated here rather than
// exported from it purely so a test can import it; the two files have no
// other reason to share code.
function currentPeriod(): string {
  const now = new Date();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${now.getUTCFullYear()}-${month}-01`;
}

// Invite emails link to the accept page with the raw token in the query
// string — see members.e2e-spec.ts's identical helper.
function extractInviteToken(
  sentEmails: ReturnType<typeof createFakeMailer>['sent'],
  toEmail: string,
): string {
  const email = [...sentEmails]
    .reverse()
    .find((candidate) => candidate.to === toEmail);
  if (!email) {
    throw new Error(`No email sent to ${toEmail}`);
  }
  const match = /token=([a-f0-9]+)/.exec(email.html ?? '');
  if (!match) {
    throw new Error('No token found in invite email');
  }
  return match[1];
}

const SHARE_PRICE = 50_000;

describe('Contributions (e2e)', () => {
  let app: INestApplication<App>;
  let testDb: TestDatabase;
  let sentEmails: ReturnType<typeof createFakeMailer>['sent'];

  const FOUNDER = {
    tenantName: 'Contributions Test Coop',
    email: 'founder@example.com',
    password: 'correct-horse-battery',
  };
  const PASSWORD = 'correct-horse-battery';

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

  async function inviteAndAccept(
    founderToken: string,
    email: string,
    permissions: string[],
  ): Promise<AuthSession> {
    await request(app.getHttpServer())
      .post('/members/invite')
      .set('Authorization', `Bearer ${founderToken}`)
      .send({ email, permissions });
    const token = extractInviteToken(sentEmails, email);
    const response = await request(app.getHttpServer())
      .post('/members/invites/accept')
      .send({ token, password: PASSWORD });
    return bodyAs<AuthSession>(response);
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

  async function recordContribution(
    token: string,
    membershipId: string,
    amount: number,
  ) {
    return request(app.getHttpServer())
      .post('/contributions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        membershipId,
        amount,
        contributedAt: currentPeriod(),
        allocations: [{ period: currentPeriod(), amount }],
      });
  }

  async function firstContributionId(token: string): Promise<string> {
    const list = await request(app.getHttpServer())
      .get('/contributions')
      .set('Authorization', `Bearer ${token}`);
    const [contribution] = bodyAs<{ contributions: Array<{ id: string }> }>(
      list,
    ).contributions;
    return contribution.id;
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

  describe('POST /contributions/settings', () => {
    it('lets an admin set the share price', async () => {
      const founder = await signupFounder();
      const response = await setSharePrice(
        founder.accessToken,
        SHARE_PRICE,
        currentPeriod(),
      );
      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        amount: SHARE_PRICE,
        effectiveFrom: currentPeriod(),
      });

      const settings = await request(app.getHttpServer())
        .get('/contributions/settings')
        .set('Authorization', `Bearer ${founder.accessToken}`);
      expect(bodyAs<ShareSettingsResponse>(settings).current).toMatchObject({
        amount: SHARE_PRICE,
      });
    });

    it('rejects a duplicate effective date', async () => {
      const founder = await signupFounder();
      await setSharePrice(founder.accessToken, SHARE_PRICE, currentPeriod());
      const response = await setSharePrice(
        founder.accessToken,
        60_000,
        currentPeriod(),
      );
      expect(response.status).toBe(409);
    });

    it('rejects a member without contributions:settings', async () => {
      const founder = await signupFounder();
      const plainMember = await inviteAndAccept(
        founder.accessToken,
        'plain@example.com',
        [],
      );
      const response = await setSharePrice(
        plainMember.accessToken,
        SHARE_PRICE,
        currentPeriod(),
      );
      expect(response.status).toBe(403);
    });

    it('normalizes a mid-month effective date so the current period still has a price', async () => {
      const founder = await signupFounder();
      const founderMembershipId = await activeMembershipId(founder.accessToken);
      const midMonth = `${currentPeriod().slice(0, 7)}-24`;

      const response = await setSharePrice(
        founder.accessToken,
        SHARE_PRICE,
        midMonth,
      );
      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({ effectiveFrom: currentPeriod() });

      const preview = await request(app.getHttpServer())
        .post('/contributions/preview')
        .set('Authorization', `Bearer ${founder.accessToken}`)
        .send({ membershipId: founderMembershipId, amount: SHARE_PRICE });
      expect(preview.status).toBe(200);
    });
  });

  describe('POST /contributions/preview', () => {
    it('rejects a preview before the cooperative has a share price set', async () => {
      const founder = await signupFounder();
      const founderMembershipId = await activeMembershipId(founder.accessToken);
      const response = await request(app.getHttpServer())
        .post('/contributions/preview')
        .set('Authorization', `Bearer ${founder.accessToken}`)
        .send({ membershipId: founderMembershipId, amount: SHARE_PRICE });
      expect(response.status).toBe(400);
    });

    it('proposes a single satisfied period for an exact single-share amount', async () => {
      const founder = await signupFounder();
      const founderMembershipId = await activeMembershipId(founder.accessToken);
      await setSharePrice(founder.accessToken, SHARE_PRICE, currentPeriod());

      const response = await request(app.getHttpServer())
        .post('/contributions/preview')
        .set('Authorization', `Bearer ${founder.accessToken}`)
        .send({ membershipId: founderMembershipId, amount: SHARE_PRICE });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        lines: [
          {
            period: currentPeriod(),
            amount: SHARE_PRICE,
            sharePriceAmount: SHARE_PRICE,
            alreadyPaidBefore: 0,
            resultingStatus: 'satisfied',
          },
        ],
      });
    });

    it('reports a line completing an existing partial as satisfied, not partial', async () => {
      const founder = await signupFounder();
      const founderMembershipId = await activeMembershipId(founder.accessToken);
      await setSharePrice(founder.accessToken, SHARE_PRICE, currentPeriod());
      const firstPayment = await recordContribution(
        founder.accessToken,
        founderMembershipId,
        30_000,
      );
      expect(firstPayment.status).toBe(204);
      const contributionId = await firstContributionId(founder.accessToken);
      await request(app.getHttpServer())
        .post(`/contributions/${contributionId}/approve`)
        .set('Authorization', `Bearer ${founder.accessToken}`);

      const response = await request(app.getHttpServer())
        .post('/contributions/preview')
        .set('Authorization', `Bearer ${founder.accessToken}`)
        .send({ membershipId: founderMembershipId, amount: 20_000 });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        lines: [
          {
            period: currentPeriod(),
            amount: 20_000,
            sharePriceAmount: SHARE_PRICE,
            alreadyPaidBefore: 30_000,
            resultingStatus: 'satisfied',
          },
        ],
      });
    });
  });

  describe('recording and approval', () => {
    it('rejects allocations that do not sum to the contribution amount', async () => {
      const founder = await signupFounder();
      const founderMembershipId = await activeMembershipId(founder.accessToken);
      await setSharePrice(founder.accessToken, SHARE_PRICE, currentPeriod());

      const response = await request(app.getHttpServer())
        .post('/contributions')
        .set('Authorization', `Bearer ${founder.accessToken}`)
        .send({
          membershipId: founderMembershipId,
          amount: SHARE_PRICE,
          contributedAt: currentPeriod(),
          allocations: [
            { period: currentPeriod(), amount: SHARE_PRICE - 10_000 },
          ],
        });
      expect(response.status).toBe(400);
    });

    it('a solo admin may approve their own recorded contribution — they are the only eligible approver', async () => {
      const founder = await signupFounder();
      const founderMembershipId = await activeMembershipId(founder.accessToken);
      await setSharePrice(founder.accessToken, SHARE_PRICE, currentPeriod());

      const record = await recordContribution(
        founder.accessToken,
        founderMembershipId,
        SHARE_PRICE,
      );
      expect(record.status).toBe(204);

      const contributionId = await firstContributionId(founder.accessToken);
      const approve = await request(app.getHttpServer())
        .post(`/contributions/${contributionId}/approve`)
        .set('Authorization', `Bearer ${founder.accessToken}`);
      expect(approve.status).toBe(204);

      const summary = await request(app.getHttpServer())
        .get(`/contributions/members/${founderMembershipId}/summary`)
        .set('Authorization', `Bearer ${founder.accessToken}`);
      const body = bodyAs<MemberContributionSummary>(summary);
      expect(body.totalShares).toBe(1);
      expect(body.costBasis).toBe(SHARE_PRICE);
      expect(
        body.periods.find((period) => period.period === currentPeriod())
          ?.status,
      ).toBe('satisfied');
    });

    it('blocks self-approval once a second eligible approver exists', async () => {
      const founder = await signupFounder();
      const founderMembershipId = await activeMembershipId(founder.accessToken);
      await setSharePrice(founder.accessToken, SHARE_PRICE, currentPeriod());
      await inviteAndAccept(founder.accessToken, 'approver@example.com', [
        'contributions:approve',
      ]);

      await recordContribution(
        founder.accessToken,
        founderMembershipId,
        SHARE_PRICE,
      );
      const contributionId = await firstContributionId(founder.accessToken);

      const selfApprove = await request(app.getHttpServer())
        .post(`/contributions/${contributionId}/approve`)
        .set('Authorization', `Bearer ${founder.accessToken}`);
      expect(selfApprove.status).toBe(403);
    });

    it('lets a second approver decide once one exists', async () => {
      const founder = await signupFounder();
      const founderMembershipId = await activeMembershipId(founder.accessToken);
      await setSharePrice(founder.accessToken, SHARE_PRICE, currentPeriod());
      const approver = await inviteAndAccept(
        founder.accessToken,
        'approver2@example.com',
        ['contributions:approve'],
      );

      await recordContribution(
        founder.accessToken,
        founderMembershipId,
        SHARE_PRICE,
      );
      const contributionId = await firstContributionId(founder.accessToken);

      const approve = await request(app.getHttpServer())
        .post(`/contributions/${contributionId}/approve`)
        .set('Authorization', `Bearer ${approver.accessToken}`);
      expect(approve.status).toBe(204);
    });

    it('rejects a contribution with a reason and keeps it out of the member summary', async () => {
      const founder = await signupFounder();
      const founderMembershipId = await activeMembershipId(founder.accessToken);
      await setSharePrice(founder.accessToken, SHARE_PRICE, currentPeriod());
      await recordContribution(
        founder.accessToken,
        founderMembershipId,
        SHARE_PRICE,
      );
      const contributionId = await firstContributionId(founder.accessToken);

      const reject = await request(app.getHttpServer())
        .post(`/contributions/${contributionId}/reject`)
        .set('Authorization', `Bearer ${founder.accessToken}`)
        .send({ reason: 'Duplicate entry' });
      expect(reject.status).toBe(204);

      const summary = await request(app.getHttpServer())
        .get(`/contributions/members/${founderMembershipId}/summary`)
        .set('Authorization', `Bearer ${founder.accessToken}`);
      expect(bodyAs<MemberContributionSummary>(summary).costBasis).toBe(0);
    });
  });

  describe('permissions and tenant isolation', () => {
    it('rejects recording without contributions:record', async () => {
      const founder = await signupFounder();
      const founderMembershipId = await activeMembershipId(founder.accessToken);
      await setSharePrice(founder.accessToken, SHARE_PRICE, currentPeriod());
      const plainMember = await inviteAndAccept(
        founder.accessToken,
        'norecord@example.com',
        [],
      );

      const response = await recordContribution(
        plainMember.accessToken,
        founderMembershipId,
        SHARE_PRICE,
      );
      expect(response.status).toBe(403);
    });

    it('rejects approving without contributions:approve', async () => {
      const founder = await signupFounder();
      const founderMembershipId = await activeMembershipId(founder.accessToken);
      await setSharePrice(founder.accessToken, SHARE_PRICE, currentPeriod());
      await recordContribution(
        founder.accessToken,
        founderMembershipId,
        SHARE_PRICE,
      );
      const contributionId = await firstContributionId(founder.accessToken);
      const plainMember = await inviteAndAccept(
        founder.accessToken,
        'noapprove@example.com',
        [],
      );

      const response = await request(app.getHttpServer())
        .post(`/contributions/${contributionId}/approve`)
        .set('Authorization', `Bearer ${plainMember.accessToken}`);
      expect(response.status).toBe(403);
    });

    it("never returns another tenant's contribution ledger or summary", async () => {
      const founderA = await signupFounder();
      const founderAMembershipId = await activeMembershipId(
        founderA.accessToken,
      );
      const founderB = await signupFounder({
        email: 'founderb@example.com',
        tenantName: 'Second Coop',
      });
      await setSharePrice(founderA.accessToken, SHARE_PRICE, currentPeriod());
      // Founder B's own tenant also needs a share price set — otherwise a
      // lookup against it 400s for "not set up yet" before ever reaching
      // the tenant-scoping check this test is actually about.
      await setSharePrice(founderB.accessToken, SHARE_PRICE, currentPeriod());
      await recordContribution(
        founderA.accessToken,
        founderAMembershipId,
        SHARE_PRICE,
      );

      const listAsB = await request(app.getHttpServer())
        .get('/contributions')
        .set('Authorization', `Bearer ${founderB.accessToken}`);
      expect(
        bodyAs<{ contributions: unknown[] }>(listAsB).contributions,
      ).toHaveLength(0);

      const summaryFromB = await request(app.getHttpServer())
        .get(`/contributions/members/${founderAMembershipId}/summary`)
        .set('Authorization', `Bearer ${founderB.accessToken}`);
      expect(summaryFromB.status).toBe(404);
    });
  });
});
