import { INestApplication } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import {
  createTestDatabase,
  resetDatabase,
  type TestDatabase,
} from '@milvaloop/db/testing';
import type {
  AuditEventListResponse,
  AuthSession,
  MemberListResponse,
} from '@milvaloop/types';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { App } from 'supertest/types';

import { AuditController } from '../src/audit/audit.controller';
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
import { ExportService } from '../src/export/export.service';
import { MembersController } from '../src/members/members.controller';
import { MembersService } from '../src/members/members.service';
import { createFakeMailer } from './fakes/fake-mailer';

const SHARE_PRICE = 50_000;

function currentPeriod(): string {
  const now = new Date();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${now.getUTCFullYear()}-${month}-01`;
}

function bodyAs<T>(response: request.Response): T {
  return response.body as T;
}

// Same helper as members.e2e-spec.ts — invite emails link to the accept
// page with the raw token in the query string.
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

describe('Audit events (e2e)', () => {
  let app: INestApplication<App>;
  let testDb: TestDatabase;
  let sentEmails: ReturnType<typeof createFakeMailer>['sent'];

  const PASSWORD = 'correct-horse-battery';

  async function signupFounder(overrides?: {
    email?: string;
    tenantName?: string;
  }): Promise<AuthSession> {
    const response = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        tenantName: 'Audit Test Coop',
        name: 'Founder Person',
        email: 'founder@example.com',
        password: PASSWORD,
        ...overrides,
      });
    return bodyAs<AuthSession>(response);
  }

  async function inviteAndAccept(
    founderAccessToken: string,
    email: string,
  ): Promise<AuthSession> {
    await request(app.getHttpServer())
      .post('/members/invite')
      .set('Authorization', `Bearer ${founderAccessToken}`)
      .send({ email, permissions: [] });
    const token = extractInviteToken(sentEmails, email);
    const response = await request(app.getHttpServer())
      .post('/members/invites/accept')
      .send({ token, name: 'Invited Member', password: PASSWORD });
    return bodyAs<AuthSession>(response);
  }

  async function membershipIdByEmail(
    token: string,
    email: string,
  ): Promise<string> {
    const list = await request(app.getHttpServer())
      .get('/members')
      .set('Authorization', `Bearer ${token}`);
    const member = bodyAs<MemberListResponse>(list).members.find(
      (candidate) => candidate.email === email,
    );
    if (!member || member.status !== 'active') {
      throw new Error(`Expected an active member with email ${email}`);
    }
    return member.membershipId;
  }

  async function listEvents(token: string) {
    const response = await request(app.getHttpServer())
      .get('/audit-events')
      .set('Authorization', `Bearer ${token}`);
    return {
      status: response.status,
      body: bodyAs<AuditEventListResponse>(response),
    };
  }

  beforeAll(async () => {
    testDb = await createTestDatabase(env.DATABASE_URL);
    const { mailer, sent } = createFakeMailer();
    sentEmails = sent;

    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({})],
      controllers: [
        AuthController,
        MembersController,
        AuditController,
        ContributionsController,
      ],
      providers: [
        AuthService,
        AccessTokenGuard,
        PermissionsGuard,
        AuditLogService,
        MembersService,
        ContributionsService,
        ExportService,
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

  it('rejects an unauthenticated request', async () => {
    const response = await request(app.getHttpServer()).get('/audit-events');
    expect(response.status).toBe(401);
  });

  it('returns no events for a fresh cooperative — signup itself writes none', async () => {
    const founder = await signupFounder();
    const { status, body } = await listEvents(founder.accessToken);
    expect(status).toBe(200);
    expect(body.events).toEqual([]);
  });

  it('records an invite with the actor and target resolved, newest first', async () => {
    const founder = await signupFounder();
    await inviteAndAccept(founder.accessToken, 'invitee@example.com');

    const { status, body } = await listEvents(founder.accessToken);
    expect(status).toBe(200);

    const actions = body.events.map((event) => event.action);
    expect(actions).toEqual(['member.invite_accepted', 'member.invited']);
    expect(body.events[1]).toMatchObject({
      action: 'member.invited',
      entityType: 'membership_invite',
      actor: { name: 'Founder Person', email: 'founder@example.com' },
      metadata: { email: 'invitee@example.com', permissions: [] },
    });
  });

  it("keeps a removed member's name and email on the removal event", async () => {
    const founder = await signupFounder();
    await inviteAndAccept(founder.accessToken, 'toremove@example.com');
    const membershipId = await membershipIdByEmail(
      founder.accessToken,
      'toremove@example.com',
    );

    await request(app.getHttpServer())
      .delete(`/members/${membershipId}`)
      .set('Authorization', `Bearer ${founder.accessToken}`);

    const { body } = await listEvents(founder.accessToken);
    const removalEvent = body.events.find(
      (event) => event.action === 'member.removed',
    );
    expect(removalEvent).toMatchObject({
      entityType: 'membership',
      entityId: membershipId,
      metadata: { name: 'Invited Member', email: 'toremove@example.com' },
    });
  });

  it("never returns another tenant's events", async () => {
    const founderA = await signupFounder();
    const founderB = await signupFounder({
      email: 'founder-b@example.com',
      tenantName: 'Audit Test Coop B',
    });
    await inviteAndAccept(founderB.accessToken, 'only-in-b@example.com');

    const { body } = await listEvents(founderA.accessToken);
    expect(body.events).toEqual([]);
  });

  it("resolves the member's email on approval, not just their membershipId", async () => {
    const founder = await signupFounder();
    const founderMembershipId = await membershipIdByEmail(
      founder.accessToken,
      'founder@example.com',
    );
    await request(app.getHttpServer())
      .post('/contributions/settings')
      .set('Authorization', `Bearer ${founder.accessToken}`)
      .send({ amount: SHARE_PRICE, effectiveFrom: currentPeriod() });
    await request(app.getHttpServer())
      .post('/contributions')
      .set('Authorization', `Bearer ${founder.accessToken}`)
      .send({
        membershipId: founderMembershipId,
        amount: SHARE_PRICE,
        contributedAt: currentPeriod(),
        allocations: [{ period: currentPeriod(), amount: SHARE_PRICE }],
      });
    const list = await request(app.getHttpServer())
      .get('/contributions')
      .set('Authorization', `Bearer ${founder.accessToken}`);
    const [contribution] = bodyAs<{ contributions: Array<{ id: string }> }>(
      list,
    ).contributions;
    await request(app.getHttpServer())
      .post(`/contributions/${contribution.id}/approve`)
      .set('Authorization', `Bearer ${founder.accessToken}`);

    const { body } = await listEvents(founder.accessToken);
    const approvalEvent = body.events.find(
      (event) => event.action === 'contribution.approved',
    );
    expect(approvalEvent).toMatchObject({
      metadata: {
        membershipId: founderMembershipId,
        name: 'Founder Person',
        email: 'founder@example.com',
        amount: SHARE_PRICE,
      },
    });
  });
});
