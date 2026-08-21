import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, isNull, ne, schema, type Database } from '@milvaloop/db';
import { InviteEmail, renderEmail, type Mailer } from '@milvaloop/email';
import {
  PERMISSIONS,
  type AcceptInviteInput,
  type InviteLookupResult,
  type InviteMemberInput,
  type MemberListResponse,
  type PendingInvite,
} from '@milvaloop/types';
import * as argon2 from 'argon2';

import { AuditLogService } from '../audit/audit-log.service';
import { isUniqueViolation } from '../common/db-errors';
import { env } from '../config/env';
import { DATABASE_CONNECTION } from '../db/db.module';
import { MAILER } from '../email/mailer.module';
import type { AccessTokenClaims } from '../auth/auth.guard';
import {
  AuthService,
  type IssuedSession,
  type LoginOutcome,
} from '../auth/auth.service';
import { generateOpaqueToken, hashToken, parseTtlMs } from '../auth/tokens';

const { memberships, membershipInvites, tenants, users } = schema;

// Long enough to read an email over a weekend, unlike the 15m/1h TTLs on
// login-adjacent tokens (see AuthService) — an invite isn't proving you
// currently control an inbox, it's an offer someone can act on whenever.
const INVITE_TTL = '7d';

@Injectable()
export class MembersService {
  private readonly logger = new Logger(MembersService.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    @Inject(MAILER) private readonly mailer: Mailer,
    private readonly auditLog: AuditLogService,
    private readonly authService: AuthService,
  ) {}

  // Active memberships and pending invites in one list — see the plan doc's
  // reasoning: one place to see "who's in this cooperative" regardless of
  // status. Ungated: every member of a cooperative can see who else is in
  // it, only the write actions below are permission-gated.
  async list(tenantId: string): Promise<MemberListResponse> {
    const activeRows = await this.db
      .select({
        membershipId: memberships.id,
        userId: memberships.userId,
        email: users.email,
        permissions: memberships.permissions,
        joinedAt: memberships.createdAt,
      })
      .from(memberships)
      .innerJoin(users, eq(memberships.userId, users.id))
      .where(
        and(eq(memberships.tenantId, tenantId), isNull(memberships.removedAt)),
      );

    const inviteRows = await this.db
      .select({
        inviteId: membershipInvites.id,
        email: membershipInvites.email,
        permissions: membershipInvites.permissions,
        invitedByUserId: membershipInvites.invitedByUserId,
        invitedAt: membershipInvites.createdAt,
        expiresAt: membershipInvites.expiresAt,
      })
      .from(membershipInvites)
      .where(
        and(
          eq(membershipInvites.tenantId, tenantId),
          isNull(membershipInvites.consumedAt),
        ),
      );

    return {
      members: [
        ...activeRows.map((row) => ({
          status: 'active' as const,
          membershipId: row.membershipId,
          userId: row.userId,
          email: row.email,
          permissions: row.permissions,
          joinedAt: row.joinedAt.toISOString(),
        })),
        ...inviteRows.map((row) => ({
          status: 'invited' as const,
          inviteId: row.inviteId,
          email: row.email,
          permissions: row.permissions,
          invitedByUserId: row.invitedByUserId,
          invitedAt: row.invitedAt.toISOString(),
          expiresAt: row.expiresAt.toISOString(),
        })),
      ],
    };
  }

  async invite(
    tenantId: string,
    invitedByUserId: string,
    input: InviteMemberInput,
  ): Promise<PendingInvite> {
    const rawToken = generateOpaqueToken();
    const expiresAt = new Date(Date.now() + parseTtlMs(INVITE_TTL));

    let invite: typeof membershipInvites.$inferSelect;
    try {
      invite = await this.db.transaction(async (tx) => {
        const [row] = await tx
          .insert(membershipInvites)
          .values({
            tenantId,
            email: input.email,
            permissions: input.permissions,
            invitedByUserId,
            tokenHash: hashToken(rawToken),
            expiresAt,
          })
          .returning();

        await this.auditLog.record(tx, {
          tenantId,
          actorUserId: invitedByUserId,
          action: 'member.invited',
          entityType: 'membership_invite',
          entityId: row.id,
          metadata: { email: input.email, permissions: input.permissions },
        });

        return row;
      });
    } catch (error) {
      if (isUniqueViolation(error, 'membership_invites_pending_email_unique')) {
        throw new ConflictException(
          'An invite is already pending for this email',
        );
      }
      throw error;
    }

    // Side effects external to the database happen after the transaction
    // commits, not inside it (see CODE_QUALITY.md). Caught rather than
    // thrown, same as the other auth emails — but unlike those, this isn't
    // enumeration-sensitive (the inviter already knows the email they typed
    // exists as an invite now, the invite row was already created), so a
    // send failure is only logged for now rather than surfaced back to the
    // inviter. Making it visibly surfaced needs a response-shape change
    // (an emailSent flag); noted as a follow-up rather than done here.
    const [tenant] = await this.db
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);
    const [inviter] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, invitedByUserId))
      .limit(1);
    const acceptUrl = `${env.WEB_ORIGIN}/invite/accept?token=${rawToken}`;
    const { html, text } = await renderEmail(
      InviteEmail({
        tenantName: tenant.name,
        invitedByEmail: inviter.email,
        acceptUrl,
      }),
    );
    await this.mailer
      .send({
        to: input.email,
        subject: `You've been invited to join ${tenant.name} on MilvaLoop`,
        html,
        text,
      })
      .catch((error: unknown) => {
        this.logger.error(
          `Failed to send invite email to ${input.email}`,
          error,
        );
      });

    return {
      status: 'invited',
      inviteId: invite.id,
      email: invite.email,
      permissions: invite.permissions,
      invitedByUserId: invite.invitedByUserId,
      invitedAt: invite.createdAt.toISOString(),
      expiresAt: invite.expiresAt.toISOString(),
    };
  }

  async revokeInvite(
    tenantId: string,
    actorUserId: string,
    inviteId: string,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [invite] = await tx
        .select()
        .from(membershipInvites)
        .where(
          and(
            eq(membershipInvites.id, inviteId),
            eq(membershipInvites.tenantId, tenantId),
            isNull(membershipInvites.consumedAt),
          ),
        )
        .limit(1);
      if (!invite) {
        throw new NotFoundException('No pending invite found');
      }

      await tx
        .update(membershipInvites)
        .set({ consumedAt: new Date() })
        .where(eq(membershipInvites.id, inviteId));

      await this.auditLog.record(tx, {
        tenantId,
        actorUserId,
        action: 'member.invite_revoked',
        entityType: 'membership_invite',
        entityId: inviteId,
        metadata: { email: invite.email },
      });
    });
  }

  // Only ever edits the granular, non-admin permission set (enforced at the
  // schema layer — grantablePermissionSchema excludes TENANT_ADMIN). This
  // membership's existing TENANT_ADMIN bit, if any, is preserved untouched
  // either way: this endpoint can't grant it (schema) and deliberately
  // doesn't revoke it either, so editing someone's non-admin permissions
  // can never silently de-admin them as a side effect. Promoting/demoting
  // full admin status needs its own separate, more deliberate action —
  // no such flow exists yet (see docs/plans/members-management.md).
  async updatePermissions(
    tenantId: string,
    actorUserId: string,
    membershipId: string,
    permissions: string[],
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [membership] = await tx
        .select()
        .from(memberships)
        .where(
          and(
            eq(memberships.id, membershipId),
            eq(memberships.tenantId, tenantId),
            isNull(memberships.removedAt),
          ),
        )
        .limit(1);
      if (!membership) {
        throw new NotFoundException('No active member found');
      }

      const hasAdmin = membership.permissions.includes(
        PERMISSIONS.TENANT_ADMIN,
      );
      const nextPermissions = hasAdmin
        ? [PERMISSIONS.TENANT_ADMIN, ...permissions]
        : permissions;

      await tx
        .update(memberships)
        .set({ permissions: nextPermissions })
        .where(eq(memberships.id, membershipId));

      await this.auditLog.record(tx, {
        tenantId,
        actorUserId,
        action: 'member.permissions_updated',
        entityType: 'membership',
        entityId: membershipId,
        metadata: { before: membership.permissions, after: nextPermissions },
      });
    });
  }

  // Soft delete — see memberships.removedAt's comment for why. Blocks
  // removing the tenant's only remaining TENANT_ADMIN, the same failure
  // mode a permissions edit can't cause (see updatePermissions) but a
  // removal genuinely can, since it drops every permission the membership
  // held, admin included.
  async remove(
    tenantId: string,
    actorUserId: string,
    membershipId: string,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [membership] = await tx
        .select()
        .from(memberships)
        .where(
          and(
            eq(memberships.id, membershipId),
            eq(memberships.tenantId, tenantId),
            isNull(memberships.removedAt),
          ),
        )
        .limit(1);
      if (!membership) {
        throw new NotFoundException('No active member found');
      }

      if (membership.permissions.includes(PERMISSIONS.TENANT_ADMIN)) {
        const others = await tx
          .select({ permissions: memberships.permissions })
          .from(memberships)
          .where(
            and(
              eq(memberships.tenantId, tenantId),
              isNull(memberships.removedAt),
              ne(memberships.id, membershipId),
            ),
          );
        const hasAnotherAdmin = others.some((row) =>
          row.permissions.includes(PERMISSIONS.TENANT_ADMIN),
        );
        if (!hasAnotherAdmin) {
          throw new BadRequestException(
            'Cannot remove the only remaining admin of this cooperative',
          );
        }
      }

      await tx
        .update(memberships)
        .set({ removedAt: new Date() })
        .where(eq(memberships.id, membershipId));

      await this.auditLog.record(tx, {
        tenantId,
        actorUserId,
        action: 'member.removed',
        entityType: 'membership',
        entityId: membershipId,
        metadata: { permissions: membership.permissions },
      });
    });
  }

  // Read-only, never consumes the invite — safe to call on every page
  // load/reload (see docs/plans/invite-accept-rework.md). This is what lets
  // /invite/accept show a clean status instead of erroring on a repeat
  // visit, and what a future notifications/workspace-selection surface
  // would read from.
  async lookupInvite(token: string): Promise<InviteLookupResult> {
    const [invite] = await this.db
      .select()
      .from(membershipInvites)
      .where(eq(membershipInvites.tokenHash, hashToken(token)))
      .limit(1);
    if (!invite) {
      return { status: 'invalid' };
    }
    if (invite.consumedAt) {
      return { status: 'consumed' };
    }
    if (invite.expiresAt < new Date()) {
      return { status: 'expired' };
    }

    const [tenant] = await this.db
      .select({ name: tenants.name })
      .from(tenants)
      .where(eq(tenants.id, invite.tenantId))
      .limit(1);
    const [existingUser] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, invite.email))
      .limit(1);

    return {
      status: 'pending',
      email: invite.email,
      tenantName: tenant.name,
      hasAccount: !!existingUser,
    };
  }

  // Authenticated path — the caller already proved their own identity, so
  // this only ever adds a membership to *that* account, never anyone
  // else's. Requires the invite's email to match the caller's own (see
  // docs/plans/invite-accept-rework.md — this is what replaced the old
  // "invite link as proof of identity" behavior for existing accounts).
  async joinViaInvite(
    claims: AccessTokenClaims,
    token: string,
    rawRefreshToken: string | undefined,
  ): Promise<IssuedSession> {
    const invalid = () =>
      new BadRequestException('This invite is invalid or has expired');

    const tokenHash = hashToken(token);
    const [invite] = await this.db
      .select()
      .from(membershipInvites)
      .where(eq(membershipInvites.tokenHash, tokenHash))
      .limit(1);
    if (!invite || invite.consumedAt || invite.expiresAt < new Date()) {
      throw invalid();
    }
    if (invite.email !== claims.email) {
      throw new ForbiddenException(
        `This invite was sent to ${invite.email}, not ${claims.email}`,
      );
    }

    await this.db.transaction(async (tx) => {
      const [reloaded] = await tx
        .select()
        .from(membershipInvites)
        .where(
          and(
            eq(membershipInvites.id, invite.id),
            isNull(membershipInvites.consumedAt),
          ),
        )
        .limit(1);
      if (!reloaded) {
        throw invalid();
      }

      try {
        await tx.insert(memberships).values({
          userId: claims.sub,
          tenantId: invite.tenantId,
          permissions: invite.permissions,
        });
      } catch (error) {
        if (isUniqueViolation(error, 'memberships_user_id_tenant_id_unique')) {
          throw new ConflictException(
            'You are already a member of this cooperative',
          );
        }
        throw error;
      }

      await tx
        .update(membershipInvites)
        .set({ consumedAt: new Date() })
        .where(eq(membershipInvites.id, invite.id));

      await this.auditLog.record(tx, {
        tenantId: invite.tenantId,
        actorUserId: claims.sub,
        action: 'member.invite_accepted',
        entityType: 'membership_invite',
        entityId: invite.id,
        metadata: { email: invite.email },
      });
    });

    // Reuses switchCooperative as-is: the membership now exists, so it just
    // confirms that, rotates the refresh session, and issues one scoped to
    // the tenant just joined.
    return this.authService.switchCooperative(
      claims,
      { cooperativeId: invite.tenantId },
      rawRefreshToken,
    );
  }

  // Public, no session — only ever reached once lookupInvite reports
  // hasAccount: false. password is always required now (see
  // acceptInviteSchema); an existing-account invitee goes through
  // joinViaInvite instead.
  async acceptInvite(input: AcceptInviteInput): Promise<LoginOutcome> {
    const invalid = () =>
      new BadRequestException('This invite is invalid or has expired');

    const tokenHash = hashToken(input.token);
    const [invite] = await this.db
      .select()
      .from(membershipInvites)
      .where(eq(membershipInvites.tokenHash, tokenHash))
      .limit(1);
    if (!invite || invite.consumedAt || invite.expiresAt < new Date()) {
      throw invalid();
    }

    const user = await this.db.transaction(async (tx) => {
      const [reloaded] = await tx
        .select()
        .from(membershipInvites)
        .where(
          and(
            eq(membershipInvites.id, invite.id),
            isNull(membershipInvites.consumedAt),
          ),
        )
        .limit(1);
      if (!reloaded) {
        throw invalid();
      }

      // A narrow but real race: an account could have been created for
      // this email between the frontend's lookup call and this submit
      // (e.g. the invitee signed up separately in another tab). Rejecting
      // outright — rather than silently logging in as that account, the
      // way this endpoint used to — is the whole point of this rework: an
      // invite link is authorization to join, not proof of identity.
      const [existingUser] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, invite.email))
        .limit(1);
      if (existingUser) {
        throw new ConflictException(
          'An account with this email already exists — please log in instead',
        );
      }

      // Accepting an invite emailed to this exact address is itself proof
      // of ownership — no separate verification round-trip needed, unlike
      // a self-serve signup where nothing yet ties the email to the
      // person clicking through.
      const passwordHash = await argon2.hash(input.password);
      const [targetUser] = await tx
        .insert(users)
        .values({
          email: invite.email,
          passwordHash,
          emailVerifiedAt: new Date(),
        })
        .returning();

      try {
        await tx.insert(memberships).values({
          userId: targetUser.id,
          tenantId: invite.tenantId,
          permissions: invite.permissions,
        });
      } catch (error) {
        if (isUniqueViolation(error, 'memberships_user_id_tenant_id_unique')) {
          throw new ConflictException(
            'You are already a member of this cooperative',
          );
        }
        throw error;
      }

      await tx
        .update(membershipInvites)
        .set({ consumedAt: new Date() })
        .where(eq(membershipInvites.id, invite.id));

      await this.auditLog.record(tx, {
        tenantId: invite.tenantId,
        actorUserId: targetUser.id,
        action: 'member.invite_accepted',
        entityType: 'membership_invite',
        entityId: invite.id,
        metadata: { email: invite.email },
      });

      return targetUser;
    });

    return this.authService.finishLogin(user);
  }
}
