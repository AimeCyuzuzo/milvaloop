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

// Exercises the whole Members Management feature: invite, lookup, accept
// (the no-account case) and join (the already-has-an-account case, see
// docs/plans/invite-accept-rework.md for why these are two separate
// endpoints now), revoke, edit permissions, remove — and the two
// correctness guards that matter most (a permissions edit can never
// silently drop admin status, a removal can never drop the only remaining
// admin).
describe('Members (e2e)', () => {
  let app: INestApplication<App>;
  let testDb: TestDatabase;
  let sentEmails: ReturnType<typeof createFakeMailer>['sent'];

  const FOUNDER = {
    tenantName: 'Members Test Coop',
    name: 'Founder Person',
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
      .send({ token, name: 'Invited Member', password: PASSWORD });
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

    // A removed member staying visible with status 'removed' is covered by
    // DELETE /members/:membershipId's own test below, which is the more
    // natural place for "what does removal actually do".

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
        .send({ token, name: 'New Person', password: PASSWORD });

      expect(response.status).toBe(200);
      const session = bodyAs<AuthSession & { status: string }>(response);
      expect(session.status).toBe('authenticated');
      expect(session.tenant.name).toBe(FOUNDER.tenantName);
      expect(session.permissions).toEqual(['members:invite']);
    });

    // Accepting via this endpoint used to log the invitee straight in if an
    // account for that email already existed — the invite link acting as
    // proof of identity, no password check at all. That's gone: this
    // endpoint is only for the no-account case now (see
    // docs/plans/invite-accept-rework.md); an existing account goes through
    // POST /members/invites/:token/join instead, authenticated.
    it('rejects when an account already exists for the invited email', async () => {
      await signupFounder();
      const secondFounder = {
        tenantName: 'Second Coop',
        name: 'Second Founder',
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
        .send({ token, name: 'Founder Person', password: PASSWORD });

      expect(response.status).toBe(409);
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
        .send({ token, name: 'No Password' });
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
        .send({ token, name: 'Once Only', password: PASSWORD });
      expect(first.status).toBe(200);

      const second = await request(app.getHttpServer())
        .post('/members/invites/accept')
        .send({ token, name: 'Once Only', password: PASSWORD });
      expect(second.status).toBe(400);
    });
  });

  describe('GET /members/invites/lookup', () => {
    it('reports a pending invite with no account yet', async () => {
      const founder = await signupFounder();
      await request(app.getHttpServer())
        .post('/members/invite')
        .set('Authorization', `Bearer ${founder.accessToken}`)
        .send({ email: 'lookup-new@example.com', permissions: [] });
      const token = extractInviteToken(sentEmails, 'lookup-new@example.com');

      const response = await request(app.getHttpServer())
        .get('/members/invites/lookup')
        .query({ token });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: 'pending',
        email: 'lookup-new@example.com',
        tenantName: FOUNDER.tenantName,
        hasAccount: false,
      });
    });

    it('reports hasAccount: true when the invited email already has one', async () => {
      const founder = await signupFounder();
      const secondFounder = {
        tenantName: 'Second Coop',
        name: 'Second Founder',
        email: 'lookup-existing@example.com',
        password: PASSWORD,
      };
      await request(app.getHttpServer())
        .post('/auth/signup')
        .send(secondFounder);
      await request(app.getHttpServer())
        .post('/members/invite')
        .set('Authorization', `Bearer ${founder.accessToken}`)
        .send({ email: secondFounder.email, permissions: [] });
      const token = extractInviteToken(sentEmails, secondFounder.email);

      const response = await request(app.getHttpServer())
        .get('/members/invites/lookup')
        .query({ token });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: 'pending',
        hasAccount: true,
      });
    });

    it('reports consumed for an already-accepted invite', async () => {
      const founder = await signupFounder();
      await request(app.getHttpServer())
        .post('/members/invite')
        .set('Authorization', `Bearer ${founder.accessToken}`)
        .send({ email: 'lookup-consumed@example.com', permissions: [] });
      const token = extractInviteToken(
        sentEmails,
        'lookup-consumed@example.com',
      );
      await request(app.getHttpServer())
        .post('/members/invites/accept')
        .send({ token, name: 'Consumed Invite', password: PASSWORD });

      const response = await request(app.getHttpServer())
        .get('/members/invites/lookup')
        .query({ token });

      expect(response.body).toEqual({ status: 'consumed' });
    });

    it('reports invalid for an unrecognized token', async () => {
      const response = await request(app.getHttpServer())
        .get('/members/invites/lookup')
        .query({ token: 'not-a-real-token' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'invalid' });
    });
  });

  describe('POST /members/invites/:token/join', () => {
    it('adds a membership to the currently authenticated account when the email matches', async () => {
      const founder = await signupFounder();
      const secondFounder = {
        tenantName: 'Second Coop',
        name: 'Second Founder',
        email: 'joiner@example.com',
        password: PASSWORD,
      };
      const secondSignup = await request(app.getHttpServer())
        .post('/auth/signup')
        .send(secondFounder);
      const second = bodyAs<AuthSession>(secondSignup);

      await request(app.getHttpServer())
        .post('/members/invite')
        .set('Authorization', `Bearer ${founder.accessToken}`)
        .send({ email: secondFounder.email, permissions: ['members:invite'] });
      const token = extractInviteToken(sentEmails, secondFounder.email);

      const response = await request(app.getHttpServer())
        .post(`/members/invites/${token}/join`)
        .set('Authorization', `Bearer ${second.accessToken}`)
        .send();

      expect(response.status).toBe(200);
      const session = bodyAs<AuthSession>(response);
      expect(session.tenant.name).toBe(FOUNDER.tenantName);
      expect(session.permissions).toEqual(['members:invite']);

      const list = await request(app.getHttpServer())
        .get('/members')
        .set('Authorization', `Bearer ${session.accessToken}`);
      expect(bodyAs<MemberListResponse>(list).members).toHaveLength(2);
    });

    it("rejects when the authenticated caller's email doesn't match the invite", async () => {
      const founder = await signupFounder();
      const other = {
        tenantName: 'Other Coop',
        name: 'Other Person',
        email: 'notinvited@example.com',
        password: PASSWORD,
      };
      const otherSignup = await request(app.getHttpServer())
        .post('/auth/signup')
        .send(other);
      const otherSession = bodyAs<AuthSession>(otherSignup);

      await request(app.getHttpServer())
        .post('/members/invite')
        .set('Authorization', `Bearer ${founder.accessToken}`)
        .send({ email: 'someone-invited@example.com', permissions: [] });
      const token = extractInviteToken(
        sentEmails,
        'someone-invited@example.com',
      );

      const response = await request(app.getHttpServer())
        .post(`/members/invites/${token}/join`)
        .set('Authorization', `Bearer ${otherSession.accessToken}`)
        .send();

      expect(response.status).toBe(403);
    });

    it('rejects an unauthenticated request', async () => {
      const founder = await signupFounder();
      await request(app.getHttpServer())
        .post('/members/invite')
        .set('Authorization', `Bearer ${founder.accessToken}`)
        .send({ email: 'needslogin@example.com', permissions: [] });
      const token = extractInviteToken(sentEmails, 'needslogin@example.com');

      const response = await request(app.getHttpServer())
        .post(`/members/invites/${token}/join`)
        .send();

      expect(response.status).toBe(401);
    });

    it('enforces single use', async () => {
      const founder = await signupFounder();
      const secondFounder = {
        tenantName: 'Second Coop',
        name: 'Second Founder',
        email: 'usedjoin@example.com',
        password: PASSWORD,
      };
      const secondSignup = await request(app.getHttpServer())
        .post('/auth/signup')
        .send(secondFounder);
      const second = bodyAs<AuthSession>(secondSignup);
      await request(app.getHttpServer())
        .post('/members/invite')
        .set('Authorization', `Bearer ${founder.accessToken}`)
        .send({ email: secondFounder.email, permissions: [] });
      const token = extractInviteToken(sentEmails, secondFounder.email);

      const first = await request(app.getHttpServer())
        .post(`/members/invites/${token}/join`)
        .set('Authorization', `Bearer ${second.accessToken}`)
        .send();
      expect(first.status).toBe(200);

      const secondAttempt = await request(app.getHttpServer())
        .post(`/members/invites/${token}/join`)
        .set('Authorization', `Bearer ${second.accessToken}`)
        .send();
      expect(secondAttempt.status).toBe(400);
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
        .send({ token, name: 'Revoke Me', password: PASSWORD });
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

  describe('PATCH /members/:membershipId/reminders', () => {
    async function activeMember(token: string, email: string) {
      const list = await request(app.getHttpServer())
        .get('/members')
        .set('Authorization', `Bearer ${token}`);
      const member = bodyAs<MemberListResponse>(list).members.find(
        (candidate) =>
          candidate.status === 'active' && candidate.email === email,
      );
      if (!member || member.status !== 'active') {
        throw new Error(`Expected an active member with email ${email}`);
      }
      return member;
    }

    it('pauses and resumes your own reminders, reflected back in the member list', async () => {
      const founder = await signupFounder();
      const plainMember = await inviteAndAccept(
        founder.accessToken,
        'pauseme@example.com',
        [],
      );
      const target = await activeMember(
        founder.accessToken,
        'pauseme@example.com',
      );
      expect(target.remindersPausedAt).toBeNull();

      const pauseResponse = await request(app.getHttpServer())
        .patch(`/members/${target.membershipId}/reminders`)
        .set('Authorization', `Bearer ${plainMember.accessToken}`)
        .send({ paused: true });
      expect(pauseResponse.status).toBe(204);

      const paused = await activeMember(
        founder.accessToken,
        'pauseme@example.com',
      );
      expect(paused.remindersPausedAt).not.toBeNull();

      const resumeResponse = await request(app.getHttpServer())
        .patch(`/members/${target.membershipId}/reminders`)
        .set('Authorization', `Bearer ${plainMember.accessToken}`)
        .send({ paused: false });
      expect(resumeResponse.status).toBe(204);

      const resumed = await activeMember(
        founder.accessToken,
        'pauseme@example.com',
      );
      expect(resumed.remindersPausedAt).toBeNull();
    });

    it('is a no-op when already in the requested state', async () => {
      const founder = await signupFounder();
      const plainMember = await inviteAndAccept(
        founder.accessToken,
        'alreadyactive@example.com',
        [],
      );
      const target = await activeMember(
        founder.accessToken,
        'alreadyactive@example.com',
      );

      const response = await request(app.getHttpServer())
        .patch(`/members/${target.membershipId}/reminders`)
        .set('Authorization', `Bearer ${plainMember.accessToken}`)
        .send({ paused: false });
      expect(response.status).toBe(204);
    });

    it("rejects pausing someone else's reminders, even as tenant:admin", async () => {
      const founder = await signupFounder();
      await inviteAndAccept(founder.accessToken, 'notmine@example.com', []);
      const target = await activeMember(
        founder.accessToken,
        'notmine@example.com',
      );

      const response = await request(app.getHttpServer())
        .patch(`/members/${target.membershipId}/reminders`)
        .set('Authorization', `Bearer ${founder.accessToken}`)
        .send({ paused: true });
      expect(response.status).toBe(403);

      // Confirms this wasn't silently a no-op that happened to return 403
      // for an unrelated reason — the target's state genuinely didn't move.
      const unchanged = await activeMember(
        founder.accessToken,
        'notmine@example.com',
      );
      expect(unchanged.remindersPausedAt).toBeNull();
    });

    it('returns 404 for a membership that does not exist', async () => {
      const founder = await signupFounder();
      const response = await request(app.getHttpServer())
        .patch('/members/00000000-0000-4000-8000-000000000000/reminders')
        .set('Authorization', `Bearer ${founder.accessToken}`)
        .send({ paused: true });
      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /members/:membershipId', () => {
    it('soft-removes a member, who stays visible in the list with status "removed"', async () => {
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
      const updatedMembers = bodyAs<MemberListResponse>(updatedList).members;
      expect(updatedMembers).toHaveLength(2);
      expect(updatedMembers).toContainEqual(
        expect.objectContaining({
          status: 'removed',
          membershipId: target.membershipId,
          email: 'removeme@example.com',
        }),
      );
    });

    it('emails the removed member, naming who removed them and the cooperative', async () => {
      const founder = await signupFounder();
      await inviteAndAccept(founder.accessToken, 'removeme2@example.com', []);
      const list = await request(app.getHttpServer())
        .get('/members')
        .set('Authorization', `Bearer ${founder.accessToken}`);
      const target = bodyAs<MemberListResponse>(list).members.find(
        (m) => m.status === 'active' && m.email === 'removeme2@example.com',
      );
      if (!target || target.status !== 'active') {
        throw new Error('Expected member not found');
      }

      await request(app.getHttpServer())
        .delete(`/members/${target.membershipId}`)
        .set('Authorization', `Bearer ${founder.accessToken}`);

      // Both the invite and the removal email went to the same address —
      // the invite arrived first, so the removal is the latest one.
      const removalEmail = [...sentEmails]
        .reverse()
        .find((email) => email.to === 'removeme2@example.com');
      expect(removalEmail?.subject).toContain('removed from');
      expect(removalEmail?.html).toContain(FOUNDER.name);
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
