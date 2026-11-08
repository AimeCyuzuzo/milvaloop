import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  and,
  eq,
  isNotNull,
  isNull,
  ne,
  schema,
  type Database,
} from '@milvaloop/db';
import {
  InviteEmail,
  MemberRemovedEmail,
  renderEmail,
  type Mailer,
} from '@milvaloop/email';
import {
  FREE_PLAN_MEMBER_CAP,
  PERMISSIONS,
  type AcceptInviteInput,
  type AddPlaceholderMemberInput,
  type InviteLookupResult,
  type InviteMemberInput,
  type MemberImportMapping,
  type MemberImportPreview,
  type MemberImportResult,
  type MemberListResponse,
  type PendingInvite,
} from '@milvaloop/types';
import * as argon2 from 'argon2';
import { z } from 'zod';

import { AuditLogService } from '../audit/audit-log.service';
import { isUniqueViolation } from '../common/db-errors';
import { todayIsoDate } from '../common/dates';
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
import {
  applyMemberImportMapping,
  parseMemberImportWorkbook,
} from './member-import';

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

  // Active memberships, pending invites, and removed memberships in one
  // list — see the plan doc's reasoning: one place to see "who's in this
  // cooperative" regardless of status. A removed member stays visible
  // rather than disappearing (their history is still real, see
  // ContributionsService), just with none of an active member's levers.
  // Ungated: every member of a cooperative can see this, only the write
  // actions below are permission-gated.
  async list(tenantId: string): Promise<MemberListResponse> {
    const activeRows = await this.db
      .select({
        membershipId: memberships.id,
        userId: memberships.userId,
        name: users.name,
        email: users.email,
        claimedAt: users.claimedAt,
        permissions: memberships.permissions,
        joinedAt: memberships.createdAt,
        memberSince: memberships.memberSince,
        remindersPausedAt: memberships.remindersPausedAt,
        digestPausedAt: memberships.digestPausedAt,
      })
      .from(memberships)
      .innerJoin(users, eq(memberships.userId, users.id))
      .where(
        and(eq(memberships.tenantId, tenantId), isNull(memberships.removedAt)),
      );

    const removedRows = await this.db
      .select({
        membershipId: memberships.id,
        userId: memberships.userId,
        name: users.name,
        email: users.email,
        claimedAt: users.claimedAt,
        permissions: memberships.permissions,
        joinedAt: memberships.createdAt,
        memberSince: memberships.memberSince,
        removedAt: memberships.removedAt,
      })
      .from(memberships)
      .innerJoin(users, eq(memberships.userId, users.id))
      .where(
        and(
          eq(memberships.tenantId, tenantId),
          isNotNull(memberships.removedAt),
        ),
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
          name: row.name,
          email: row.email,
          hasLogin: row.claimedAt !== null,
          permissions: row.permissions,
          joinedAt: row.joinedAt.toISOString(),
          memberSince: row.memberSince,
          remindersPausedAt: row.remindersPausedAt?.toISOString() ?? null,
          digestPausedAt: row.digestPausedAt?.toISOString() ?? null,
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
        ...removedRows.map((row) => ({
          status: 'removed' as const,
          membershipId: row.membershipId,
          userId: row.userId,
          name: row.name,
          email: row.email,
          hasLogin: row.claimedAt !== null,
          permissions: row.permissions,
          joinedAt: row.joinedAt.toISOString(),
          memberSince: row.memberSince,
          // Non-null by construction (see the isNotNull filter above) —
          // Drizzle's column type stays nullable regardless of the query's
          // WHERE clause, so this is genuinely safe, not a lie to the type.
          removedAt: row.removedAt!.toISOString(),
        })),
      ],
    };
  }

  // Counts active members plus already-pending invites — a Free-plan
  // tenant is blocked from *starting* an eleventh addition, not surprised
  // later when someone finally accepts an invite sent while still under
  // the cap (see FREE_PLAN_MEMBER_CAP). A no-op for Premium, which has no
  // member ceiling — see tenant-access.ts, scaling there is a billing fact
  // communicated on the pricing page, not something this app enforces.
  private async assertUnderFreePlanCap(tenantId: string): Promise<void> {
    const [tenant] = await this.db
      .select({ plan: tenants.plan })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);
    if (tenant?.plan !== 'free') {
      return;
    }

    const activeRows = await this.db
      .select({ id: memberships.id })
      .from(memberships)
      .where(
        and(eq(memberships.tenantId, tenantId), isNull(memberships.removedAt)),
      );
    const pendingRows = await this.db
      .select({ id: membershipInvites.id })
      .from(membershipInvites)
      .where(
        and(
          eq(membershipInvites.tenantId, tenantId),
          isNull(membershipInvites.consumedAt),
        ),
      );

    if (activeRows.length + pendingRows.length >= FREE_PLAN_MEMBER_CAP) {
      throw new ForbiddenException(
        `The Free plan is limited to ${FREE_PLAN_MEMBER_CAP} members — upgrade to Premium to add more.`,
      );
    }
  }

  async invite(
    tenantId: string,
    invitedByUserId: string,
    input: InviteMemberInput,
  ): Promise<PendingInvite> {
    await this.assertUnderFreePlanCap(tenantId);

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
        invitedByName: inviter.name,
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

  // A member added by name only, with no login at all — common where a
  // member has no email or smartphone (see PLATFORM_BRAINSTORMING.md).
  // Gets a synthetic, guaranteed-unique, non-deliverable email (the
  // `.invalid` TLD is reserved by RFC 2606 for addresses that are never
  // real) and a password hash of a random, immediately-discarded value —
  // `claimedAt` stays null, which is the only thing that actually matters
  // for recognizing this as a placeholder (see users.ts).
  async addPlaceholderMember(
    tenantId: string,
    actorUserId: string,
    input: AddPlaceholderMemberInput,
  ): Promise<void> {
    await this.assertUnderFreePlanCap(tenantId);

    const passwordHash = await argon2.hash(generateOpaqueToken());
    const syntheticEmail = `placeholder-${generateOpaqueToken().slice(0, 16)}@members.milvaloop.invalid`;

    await this.db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({
          name: input.name,
          email: syntheticEmail,
          passwordHash,
          claimedAt: null,
        })
        .returning();

      const [membership] = await tx
        .insert(memberships)
        .values({
          userId: user.id,
          tenantId,
          permissions: [],
          memberSince: input.memberSince,
        })
        .returning();

      await this.auditLog.record(tx, {
        tenantId,
        actorUserId,
        action: 'member.added',
        entityType: 'membership',
        entityId: membership.id,
        metadata: { name: input.name },
      });
    });
  }

  // Attaches a real login to an existing placeholder membership — sends a
  // claim-login invite that, on accept, updates that same user row in
  // place (see acceptInvite's claimUserId branch) rather than creating a
  // new membership, so the placeholder's history stays exactly where it
  // is.
  async inviteLoginForPlaceholder(
    tenantId: string,
    membershipId: string,
    actorUserId: string,
    email: string,
  ): Promise<void> {
    const [membership] = await this.db
      .select({
        userId: memberships.userId,
        name: users.name,
        claimedAt: users.claimedAt,
      })
      .from(memberships)
      .innerJoin(users, eq(memberships.userId, users.id))
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
    if (membership.claimedAt) {
      throw new BadRequestException('This member already has a login');
    }

    const rawToken = generateOpaqueToken();
    const expiresAt = new Date(Date.now() + parseTtlMs(INVITE_TTL));

    let invite: typeof membershipInvites.$inferSelect;
    try {
      invite = await this.db.transaction(async (tx) => {
        const [row] = await tx
          .insert(membershipInvites)
          .values({
            tenantId,
            email,
            permissions: [],
            invitedByUserId: actorUserId,
            claimUserId: membership.userId,
            tokenHash: hashToken(rawToken),
            expiresAt,
          })
          .returning();

        await this.auditLog.record(tx, {
          tenantId,
          actorUserId,
          action: 'member.login_invited',
          entityType: 'membership_invite',
          entityId: row.id,
          metadata: { name: membership.name, email },
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

    const [tenant] = await this.db
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);
    const [inviter] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, actorUserId))
      .limit(1);
    const acceptUrl = `${env.WEB_ORIGIN}/invite/accept?token=${rawToken}`;
    const { html, text } = await renderEmail(
      InviteEmail({
        tenantName: tenant.name,
        invitedByName: inviter.name,
        acceptUrl,
      }),
    );
    await this.mailer
      .send({
        to: invite.email,
        subject: `Claim your login for ${tenant.name} on MilvaLoop`,
        html,
        text,
      })
      .catch((error: unknown) => {
        this.logger.error(
          `Failed to send claim-login invite email to ${invite.email}`,
          error,
        );
      });
  }

  // Parses only the first sheet's headers and a small sample of rows — the
  // frontend drives its column-mapping form from this, without a second
  // upload once the mapping is confirmed.
  async previewImport(buffer: Buffer): Promise<MemberImportPreview> {
    const parsed = await parseMemberImportWorkbook(buffer);
    return { columns: parsed.columns, sampleRows: parsed.rows.slice(0, 5) };
  }

  // Every row is processed independently and reported on — one bad row
  // (no name, a malformed email) never drops the rest, and the caller
  // always gets a complete, honest picture of what happened rather than a
  // silent partial success. A mapped email becomes a normal invite (see
  // invite() above, reused as-is rather than duplicated); no email
  // becomes a placeholder member.
  async importMembers(
    tenantId: string,
    actorUserId: string,
    buffer: Buffer,
    mapping: MemberImportMapping,
  ): Promise<MemberImportResult> {
    const parsed = await parseMemberImportWorkbook(buffer);
    const mapped = applyMemberImportMapping(parsed.rows, mapping);

    const rows: MemberImportResult['rows'] = [];
    for (const [index, row] of mapped.entries()) {
      // +1 for the header row, +1 to move from a 0-index to a 1-index —
      // this is the row number a person opening the same file in Excel
      // would see it as.
      const rowNumber = index + 2;
      if (!row) {
        rows.push({
          outcome: 'skipped',
          row: rowNumber,
          reason: 'No name found in this row',
        });
        continue;
      }

      try {
        if (row.email) {
          if (!z.email().safeParse(row.email).success) {
            rows.push({
              outcome: 'skipped',
              row: rowNumber,
              reason: `"${row.email}" isn't a valid email`,
            });
            continue;
          }
          await this.invite(tenantId, actorUserId, {
            email: row.email,
            permissions: [],
          });
          rows.push({
            outcome: 'invited',
            row: rowNumber,
            name: row.name,
            email: row.email,
          });
        } else {
          await this.addPlaceholderMember(tenantId, actorUserId, {
            name: row.name,
            memberSince: mapping.memberSince,
          });
          rows.push({ outcome: 'added', row: rowNumber, name: row.name });
        }
      } catch (error) {
        rows.push({
          outcome: 'skipped',
          row: rowNumber,
          reason:
            error instanceof ConflictException
              ? error.message
              : 'Could not add this row',
        });
      }
    }

    return { rows };
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
        .select({
          permissions: memberships.permissions,
          name: users.name,
          email: users.email,
        })
        .from(memberships)
        .innerJoin(users, eq(memberships.userId, users.id))
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
        metadata: {
          name: membership.name,
          email: membership.email,
          before: membership.permissions,
          after: nextPermissions,
        },
      });
    });
  }

  // Whether this member gets the daily contribution-reminder cron's
  // emails (see ContributionReminderService) — a personal preference, not
  // an admin lever: no permission check gates this beyond being the
  // member it's about, same as changing your own password would be. A
  // no-op call (pausing an already-paused membership, or resuming one
  // that isn't paused) writes nothing and logs nothing — an audit entry
  // describes a change that happened, not a request that happened to
  // match the current state.
  async updateReminderPause(
    tenantId: string,
    actorUserId: string,
    membershipId: string,
    paused: boolean,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [membership] = await tx
        .select({
          userId: memberships.userId,
          remindersPausedAt: memberships.remindersPausedAt,
          name: users.name,
          email: users.email,
        })
        .from(memberships)
        .innerJoin(users, eq(memberships.userId, users.id))
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
      if (membership.userId !== actorUserId) {
        throw new ForbiddenException(
          'You can only manage your own reminder preference',
        );
      }

      const isCurrentlyPaused = membership.remindersPausedAt !== null;
      if (isCurrentlyPaused === paused) {
        return;
      }

      await tx
        .update(memberships)
        .set({ remindersPausedAt: paused ? new Date() : null })
        .where(eq(memberships.id, membershipId));

      await this.auditLog.record(tx, {
        tenantId,
        actorUserId,
        action: paused ? 'member.reminders_paused' : 'member.reminders_resumed',
        entityType: 'membership',
        entityId: membershipId,
        metadata: { name: membership.name, email: membership.email },
      });
    });
  }

  // Same shape and the same self-only rule as updateReminderPause above,
  // but for the monthly cooperative-wide digest (see MonthlyDigestService)
  // rather than personal payment reminders — a separate column so a
  // member can keep one email without the other.
  async updateDigestPause(
    tenantId: string,
    actorUserId: string,
    membershipId: string,
    paused: boolean,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [membership] = await tx
        .select({
          userId: memberships.userId,
          digestPausedAt: memberships.digestPausedAt,
          name: users.name,
          email: users.email,
        })
        .from(memberships)
        .innerJoin(users, eq(memberships.userId, users.id))
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
      if (membership.userId !== actorUserId) {
        throw new ForbiddenException(
          'You can only manage your own digest preference',
        );
      }

      const isCurrentlyPaused = membership.digestPausedAt !== null;
      if (isCurrentlyPaused === paused) {
        return;
      }

      await tx
        .update(memberships)
        .set({ digestPausedAt: paused ? new Date() : null })
        .where(eq(memberships.id, membershipId));

      await this.auditLog.record(tx, {
        tenantId,
        actorUserId,
        action: paused ? 'member.digest_paused' : 'member.digest_resumed',
        entityType: 'membership',
        entityId: membershipId,
        metadata: { name: membership.name, email: membership.email },
      });
    });
  }

  // Soft delete — see memberships.removedAt's comment for why. Blocks
  // removing the tenant's only remaining TENANT_ADMIN, the same failure
  // mode a permissions edit can't cause (see updatePermissions) but a
  // removal genuinely can, since it drops every permission the membership
  // held, admin included. Notifies the removed member by email — losing
  // access to a cooperative shouldn't be silent, the same reasoning that
  // makes an invite email non-optional.
  async remove(
    tenantId: string,
    actorUserId: string,
    membershipId: string,
  ): Promise<void> {
    const removed = await this.db.transaction(async (tx) => {
      const [membership] = await tx
        .select({
          permissions: memberships.permissions,
          name: users.name,
          email: users.email,
        })
        .from(memberships)
        .innerJoin(users, eq(memberships.userId, users.id))
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
        metadata: {
          name: membership.name,
          email: membership.email,
          permissions: membership.permissions,
        },
      });

      return membership;
    });

    // Side effect external to the database, after the transaction commits
    // (see CODE_QUALITY.md) — a send failure here shouldn't undo a removal
    // that already took effect, so it's only logged, not surfaced back to
    // the actor (same reasoning as invite()'s email).
    const [tenant] = await this.db
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);
    const [actor] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, actorUserId))
      .limit(1);
    const { html, text } = await renderEmail(
      MemberRemovedEmail({
        memberName: removed.name,
        cooperativeName: tenant.name,
        removedByName: actor.name,
      }),
    );
    await this.mailer
      .send({
        to: removed.email,
        subject: `You've been removed from ${tenant.name} on MilvaLoop`,
        html,
        text,
      })
      .catch((error: unknown) => {
        this.logger.error(
          `Failed to send removal email to ${removed.email}`,
          error,
        );
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

    let claimName: string | null = null;
    if (invite.claimUserId) {
      const [placeholder] = await this.db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, invite.claimUserId))
        .limit(1);
      claimName = placeholder?.name ?? null;
    }

    return {
      status: 'pending',
      email: invite.email,
      tenantName: tenant.name,
      hasAccount: !!existingUser,
      isClaim: !!invite.claimUserId,
      claimName,
    };
  }

  // Authenticated path — the caller already proved their own identity, so
  // this only ever adds a membership to *that* account, never anyone
  // else's. Requires the invite's email to match the caller's own: an
  // invite link is authorization to join a cooperative, not proof of
  // identity, so it can't be used to sign in as someone else's account
  // (see docs/plans/invite-accept-rework.md for the full design).
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
    if (invite.claimUserId) {
      // Reaching this path means the target email already belongs to an
      // existing MilvaLoop account (that's exactly what routes the
      // frontend here instead of acceptInvite) — merging a placeholder's
      // history into a separate, pre-existing identity is out of scope
      // for now (see acceptInvite's matching guard).
      throw new BadRequestException(
        "This member's history can't be linked to an existing MilvaLoop account",
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
          memberSince: todayIsoDate(),
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

      const [joiningUser] = await tx
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, claims.sub))
        .limit(1);

      await this.auditLog.record(tx, {
        tenantId: invite.tenantId,
        actorUserId: claims.sub,
        action: 'member.invite_accepted',
        entityType: 'membership_invite',
        entityId: invite.id,
        metadata: { name: joiningUser?.name, email: invite.email },
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
      // outright, rather than logging in as that account, follows directly
      // from the same rule as joinViaInvite above: an invite link is
      // authorization to join, not proof of identity. This also doubles as
      // the claim-login flow's collision guard below — merging a
      // placeholder's history into a pre-existing MilvaLoop identity is
      // out of scope, so it's rejected the same way.
      const [existingUser] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, invite.email))
        .limit(1);
      if (existingUser) {
        throw new ConflictException(
          invite.claimUserId
            ? "An account with this email already exists — this member's history can't be automatically linked"
            : 'An account with this email already exists — please log in instead',
        );
      }

      // Accepting an invite emailed to this exact address is itself proof
      // of ownership — no separate verification round-trip needed, unlike
      // a self-serve signup where nothing yet ties the email to the
      // person clicking through.
      const passwordHash = await argon2.hash(input.password);

      let targetUser: typeof users.$inferSelect;
      if (invite.claimUserId) {
        // Claiming a placeholder updates its existing user row in place —
        // same id, so the membership it already belongs to (and every
        // contribution/audit event that already references it) is
        // untouched. No memberships insert: it already exists.
        const [placeholder] = await tx
          .select({ claimedAt: users.claimedAt })
          .from(users)
          .where(eq(users.id, invite.claimUserId))
          .limit(1);
        if (!placeholder || placeholder.claimedAt) {
          throw invalid();
        }
        const [updated] = await tx
          .update(users)
          .set({
            name: input.name,
            email: invite.email,
            passwordHash,
            emailVerifiedAt: new Date(),
            claimedAt: new Date(),
          })
          .where(eq(users.id, invite.claimUserId))
          .returning();
        targetUser = updated;
      } else {
        const [inserted] = await tx
          .insert(users)
          .values({
            name: input.name,
            email: invite.email,
            passwordHash,
            emailVerifiedAt: new Date(),
            claimedAt: new Date(),
          })
          .returning();
        targetUser = inserted;

        try {
          await tx.insert(memberships).values({
            userId: targetUser.id,
            tenantId: invite.tenantId,
            permissions: invite.permissions,
            memberSince: todayIsoDate(),
          });
        } catch (error) {
          if (
            isUniqueViolation(error, 'memberships_user_id_tenant_id_unique')
          ) {
            throw new ConflictException(
              'You are already a member of this cooperative',
            );
          }
          throw error;
        }
      }

      await tx
        .update(membershipInvites)
        .set({ consumedAt: new Date() })
        .where(eq(membershipInvites.id, invite.id));

      await this.auditLog.record(tx, {
        tenantId: invite.tenantId,
        actorUserId: targetUser.id,
        action: invite.claimUserId
          ? 'member.login_claimed'
          : 'member.invite_accepted',
        entityType: 'membership_invite',
        entityId: invite.id,
        metadata: { name: targetUser.name, email: invite.email },
      });

      return targetUser;
    });

    return this.authService.finishLogin(user);
  }
}
