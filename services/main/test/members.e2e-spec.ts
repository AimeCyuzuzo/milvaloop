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
  MemberListResponse,
  PendingInvite,
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
import { DATABASE_CONNECTION } from '../src/db/db.module';
import { MAILER } from '../src/email/mailer.module';
import { MembersController } from '../src/members/members.controller';
import { MembersService } from '../src/members/members.service';
import { createFakeMailer } from './fakes/fake-mailer';

function bodyAs<T>(response: request.Response): T {
  return response.body as T;
}

// Invite emails link to the accept page with the raw token in the query
// string, in the HTML anchor's href — same reasoning as auth.e2e-spec.ts's
// helper: the visible button text is an action label, not the URL.
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

// Exercises the whole Members Management feature: invite, accept (both the
// existing-user and new-user branches), revoke, edit permissions, remove —
// and the two correctness guards that matter most (a permissions edit can
// never silently drop admin status, a removal can never drop the only
// remaining admin).
describe('Members (e2e)', () => {
  let app: INestApplication<App>;
  let testDb: TestDatabase;
  let sentEmails: ReturnType<typeof createFakeMailer>['sent'];

  const FOUNDER = {
    tenantName: 'Members Test Coop',
    email: 'founder@example.com',
    password: 'correct-horse-battery',
  };
  const PASSWORD = 'correct-horse-battery';

  async function signupFounder(): Promise<AuthSession> {
    const response = await request(app.getHttpServer())
      .post('/auth/signup')
      .send(FOUNDER);
    return bodyAs<AuthSession>(response);
  }

  async function inviteAndAccept(
    founderAccessToken: string,
    email: string,
    permissions: string[],
  ): Promise<AuthSession> {
    await request(app.getHttpServer())
      .post('/members/invite')
      .set('Authorization', `Bearer ${founderAccessToken}`)
      .send({ email, permissions });
    const token = extractInviteToken(sentEmails, email);
    const response = await request(app.getHttpServer())
      .post('/members/invites/accept')
      .send({ token, password: PASSWORD });
    return bodyAs<AuthSession>(response);
  }

  beforeAll(async () => {
    testDb = await createTestDatabase(env.DATABASE_URL);
    const { mailer, sent } = createFakeMailer();
    sentEmails = sent;

    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({})],
      controllers: [AuthController, MembersController],
      providers: [
        AuthService,
        AccessTokenGuard,
        PermissionsGuard,
        AuditLogService,
        MembersService,
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

  describe('GET /members', () => {
    it('lists the founder as an active admin', async () => {
      const founder = await signupFounder();

      const response = await request(app.getHttpServer())
        .get('/members')
        .set('Authorization', `Bearer ${founder.accessToken}`);

      expect(response.status).toBe(200);
      const { members } = bodyAs<MemberListResponse>(response);
      expect(members).toHaveLength(1);
      expect(members[0]).toMatchObject({
        status: 'active',
        email: FOUNDER.email,
        permissions: ['tenant:admin'],
      });
    });

    it('includes a pending invite alongside active members', async () => {
      const founder = await signupFounder();
      await request(app.getHttpServer())
        .post('/members/invite')
        .set('Authorization', `Bearer ${founder.accessToken}`)
        .send({
          email: 'pending@example.com',
          permissions: ['members:invite'],
        });

      const response = await request(app.getHttpServer())
        .get('/members')
        .set('Authorization', `Bearer ${founder.accessToken}`);

      const { members } = bodyAs<MemberListResponse>(response);
      expect(members).toHaveLength(2);
      expect(members).toContainEqual(
        expect.objectContaining({
          status: 'invited',
          email: 'pending@example.com',
        }),
      );
    });

    it('rejects an unauthenticated request', async () => {
      const response = await request(app.getHttpServer()).get('/members');
      expect(response.status).toBe(401);
    });
  });

  describe('POST /members/invite', () => {
    it('creates a pending invite and sends an email', async () => {
      const founder = await signupFounder();

      const response = await request(app.getHttpServer())
        .post('/members/invite')
        .set('Authorization', `Bearer ${founder.accessToken}`)
        .send({
          email: 'invitee@example.com',
          permissions: ['members:invite'],
        });

      expect(response.status).toBe(201);
      expect(bodyAs<PendingInvite>(response)).toMatchObject({
        status: 'invited',
        email: 'invitee@example.com',
        permissions: ['members:invite'],
      });
      // Signup itself already sent the founder a verification email, so
      // this checks for the invite specifically rather than the total count.
      const inviteEmail = sentEmails.find(
        (email) => email.to === 'invitee@example.com',
      );
      expect(inviteEmail?.subject).toContain('invited to join');
    });

    it('rejects a request from a member without members:invite', async () => {
      const founder = await signupFounder();
      const plainMember = await inviteAndAccept(
        founder.accessToken,
        'plain@example.com',
        [],
      );

      const response = await request(app.getHttpServer())
        .post('/members/invite')
        .set('Authorization', `Bearer ${plainMember.accessToken}`)
        .send({ email: 'someone-else@example.com', permissions: [] });

      expect(response.status).toBe(403);
    });

    it('rejects a second simultaneous invite to the same email', async () => {
      const founder = await signupFounder();
      await request(app.getHttpServer())
        .post('/members/invite')
        .set('Authorization', `Bearer ${founder.accessToken}`)
        .send({ email: 'dup@example.com', permissions: [] });

      const response = await request(app.getHttpServer())
        .post('/members/invite')
        .set('Authorization', `Bearer ${founder.accessToken}`)
        .send({ email: 'dup@example.com', permissions: [] });

      expect(response.status).toBe(409);
    });

    it('rejects tenant:admin in the requested permissions', async () => {
      const founder = await signupFounder();

      const response = await request(app.getHttpServer())
        .post('/members/invite')
        .set('Authorization', `Bearer ${founder.accessToken}`)
        .send({
          email: 'wannabe-admin@example.com',
          permissions: ['tenant:admin'],
        });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /members/invites/accept', () => {
    it('creates a new account and membership when the email has none yet', async () => {
      const founder = await signupFounder();
      await request(app.getHttpServer())
        .post('/members/invite')
        .set('Authorization', `Bearer ${founder.accessToken}`)
        .send({
          email: 'newperson@example.com',
          permissions: ['members:invite'],
        });
      const token = extractInviteToken(sentEmails, 'newperson@example.com');

      const response = await request(app.getHttpServer())
        .post('/members/invites/accept')
        .send({ token, password: PASSWORD });

      expect(response.status).toBe(200);
      const session = bodyAs<AuthSession & { status: string }>(response);
      expect(session.status).toBe('authenticated');
      expect(session.tenant.name).toBe(FOUNDER.tenantName);
      expect(session.permissions).toEqual(['members:invite']);
    });

    it('adds a membership for an existing user and offers cooperative selection', async () => {
      await signupFounder();
      const secondFounder = {
        tenantName: 'Second Coop',
        email: 'second@example.com',
        password: PASSWORD,
      };
      const secondSignup = await request(app.getHttpServer())
        .post('/auth/signup')
        .send(secondFounder);
      const second = bodyAs<AuthSession>(secondSignup);

      await request(app.getHttpServer())
        .post('/members/invite')
        .set('Authorization', `Bearer ${second.accessToken}`)
        .send({ email: FOUNDER.email, permissions: ['members:invite'] });
      const token = extractInviteToken(sentEmails, FOUNDER.email);

      const response = await request(app.getHttpServer())
        .post('/members/invites/accept')
        .send({ token });

      expect(response.status).toBe(200);
      const result = bodyAs<{ status: string; cooperatives?: unknown[] }>(
        response,
      );
      expect(result.status).toBe('selection_required');
      expect(result.cooperatives).toHaveLength(2);
    });

    it('rejects an invalid token', async () => {
      const response = await request(app.getHttpServer())
        .post('/members/invites/accept')
        .send({ token: 'not-a-real-token' });
      expect(response.status).toBe(400);
    });

    it('rejects a new-account acceptance with no password', async () => {
      const founder = await signupFounder();
      await request(app.getHttpServer())
        .post('/members/invite')
        .set('Authorization', `Bearer ${founder.accessToken}`)
        .send({ email: 'nopassword@example.com', permissions: [] });
      const token = extractInviteToken(sentEmails, 'nopassword@example.com');

      const response = await request(app.getHttpServer())
        .post('/members/invites/accept')
        .send({ token });
      expect(response.status).toBe(400);
    });

    it('enforces single use', async () => {
      const founder = await signupFounder();
      await request(app.getHttpServer())
        .post('/members/invite')
        .set('Authorization', `Bearer ${founder.accessToken}`)
        .send({ email: 'onceonly@example.com', permissions: [] });
      const token = extractInviteToken(sentEmails, 'onceonly@example.com');

      const first = await request(app.getHttpServer())
        .post('/members/invites/accept')
        .send({ token, password: PASSWORD });
      expect(first.status).toBe(200);

      const second = await request(app.getHttpServer())
        .post('/members/invites/accept')
        .send({ token, password: PASSWORD });
      expect(second.status).toBe(400);
    });
  });

  describe('POST /members/invites/:id/revoke', () => {
    it('revokes a pending invite so it can no longer be accepted', async () => {
      const founder = await signupFounder();
      const inviteResponse = await request(app.getHttpServer())
        .post('/members/invite')
        .set('Authorization', `Bearer ${founder.accessToken}`)
        .send({ email: 'revokeme@example.com', permissions: [] });
      const invite = bodyAs<PendingInvite>(inviteResponse);
      const token = extractInviteToken(sentEmails, 'revokeme@example.com');

      const revokeResponse = await request(app.getHttpServer())
        .post(`/members/invites/${invite.inviteId}/revoke`)
        .set('Authorization', `Bearer ${founder.accessToken}`);
      expect(revokeResponse.status).toBe(204);

      const acceptResponse = await request(app.getHttpServer())
        .post('/members/invites/accept')
        .send({ token, password: PASSWORD });
      expect(acceptResponse.status).toBe(400);
    });

    it('returns 404 for an invite that does not exist', async () => {
      const founder = await signupFounder();
      const response = await request(app.getHttpServer())
        .post('/members/invites/00000000-0000-4000-8000-000000000000/revoke')
        .set('Authorization', `Bearer ${founder.accessToken}`);
      expect(response.status).toBe(404);
    });
  });

  describe('PATCH /members/:membershipId/permissions', () => {
    it("updates a plain member's permissions", async () => {
      const founder = await signupFounder();
      await inviteAndAccept(founder.accessToken, 'editme@example.com', []);
      const list = await request(app.getHttpServer())
        .get('/members')
        .set('Authorization', `Bearer ${founder.accessToken}`);
      const target = bodyAs<MemberListResponse>(list).members.find(
        (m) => m.status === 'active' && m.email === 'editme@example.com',
      );
      if (!target || target.status !== 'active') {
        throw new Error('Expected member not found');
      }

      const response = await request(app.getHttpServer())
        .patch(`/members/${target.membershipId}/permissions`)
        .set('Authorization', `Bearer ${founder.accessToken}`)
        .send({ permissions: ['members:invite', 'members:edit'] });
      expect(response.status).toBe(204);

      const updatedList = await request(app.getHttpServer())
        .get('/members')
        .set('Authorization', `Bearer ${founder.accessToken}`);
      const updated = bodyAs<MemberListResponse>(updatedList).members.find(
        (m) => m.status === 'active' && m.email === 'editme@example.com',
      );
      if (!updated || updated.status !== 'active') {
        throw new Error('Expected member not found');
      }
      expect(updated.permissions.sort()).toEqual([
        'members:edit',
        'members:invite',
      ]);
    });

    it("never drops the target's tenant:admin even though the request body can't include it", async () => {
      const founder = await signupFounder();
      const list = await request(app.getHttpServer())
        .get('/members')
        .set('Authorization', `Bearer ${founder.accessToken}`);
      const founderMembership = bodyAs<MemberListResponse>(list).members[0];
      if (founderMembership.status !== 'active') {
        throw new Error('Expected the founder to be an active member');
      }

      const response = await request(app.getHttpServer())
        .patch(`/members/${founderMembership.membershipId}/permissions`)
        .set('Authorization', `Bearer ${founder.accessToken}`)
        .send({ permissions: ['members:invite'] });
      expect(response.status).toBe(204);

      const updatedList = await request(app.getHttpServer())
        .get('/members')
        .set('Authorization', `Bearer ${founder.accessToken}`);
      const updatedFounder = bodyAs<MemberListResponse>(updatedList).members[0];
      if (updatedFounder.status !== 'active') {
        throw new Error('Expected the founder to still be an active member');
      }
      expect(updatedFounder.permissions.sort()).toEqual([
        'members:invite',
        'tenant:admin',
      ]);
    });

    it('rejects a request from a member without members:edit', async () => {
      const founder = await signupFounder();
      const plainMember = await inviteAndAccept(
        founder.accessToken,
        'noeditpermission@example.com',
        [],
      );
      const list = await request(app.getHttpServer())
        .get('/members')
        .set('Authorization', `Bearer ${founder.accessToken}`);
      const founderMembership = bodyAs<MemberListResponse>(list).members[0];
      if (founderMembership.status !== 'active') {
        throw new Error('Expected the founder to be an active member');
      }

      const response = await request(app.getHttpServer())
        .patch(`/members/${founderMembership.membershipId}/permissions`)
        .set('Authorization', `Bearer ${plainMember.accessToken}`)
        .send({ permissions: ['members:invite'] });
      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /members/:membershipId', () => {
    it('soft-removes a member so they no longer appear in the list', async () => {
      const founder = await signupFounder();
      await inviteAndAccept(founder.accessToken, 'removeme@example.com', []);
      const list = await request(app.getHttpServer())
        .get('/members')
        .set('Authorization', `Bearer ${founder.accessToken}`);
      const target = bodyAs<MemberListResponse>(list).members.find(
        (m) => m.status === 'active' && m.email === 'removeme@example.com',
      );
      if (!target || target.status !== 'active') {
        throw new Error('Expected member not found');
      }

      const response = await request(app.getHttpServer())
        .delete(`/members/${target.membershipId}`)
        .set('Authorization', `Bearer ${founder.accessToken}`);
      expect(response.status).toBe(204);

      const updatedList = await request(app.getHttpServer())
        .get('/members')
        .set('Authorization', `Bearer ${founder.accessToken}`);
      expect(bodyAs<MemberListResponse>(updatedList).members).toHaveLength(1);
    });

    it('blocks removing the only remaining admin', async () => {
      const founder = await signupFounder();
      const list = await request(app.getHttpServer())
        .get('/members')
        .set('Authorization', `Bearer ${founder.accessToken}`);
      const founderMembership = bodyAs<MemberListResponse>(list).members[0];

      const response = await request(app.getHttpServer())
        .delete(
          `/members/${(founderMembership as { membershipId: string }).membershipId}`,
        )
        .set('Authorization', `Bearer ${founder.accessToken}`);
      expect(response.status).toBe(400);
    });

    it('returns 404 for a membership that does not exist', async () => {
      const founder = await signupFounder();
      const response = await request(app.getHttpServer())
        .delete('/members/00000000-0000-4000-8000-000000000000')
        .set('Authorization', `Bearer ${founder.accessToken}`);
      expect(response.status).toBe(404);
    });
  });
});
