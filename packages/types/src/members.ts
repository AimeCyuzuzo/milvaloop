import { z } from 'zod';

import { passwordSchema, personNameSchema } from './auth.js';
import { PERMISSIONS, type Permission } from './permissions.js';

// TENANT_ADMIN is deliberately excluded — granting full admin access is a
// separate, more deliberate action than the default invite/edit-permissions
// flow this backs (see docs/plans/members-management.md). No "promote to
// admin" flow exists yet; when one is built, it needs its own endpoint,
// not a checkbox added here. Exported (not just used to build the schema
// below) so the frontend's permission checklist draws from the same list
// rather than re-deriving it.
export const GRANTABLE_PERMISSIONS = Object.values(PERMISSIONS).filter(
  (permission) => permission !== PERMISSIONS.TENANT_ADMIN,
) as Exclude<Permission, typeof PERMISSIONS.TENANT_ADMIN>[];

export const grantablePermissionSchema = z.enum(GRANTABLE_PERMISSIONS);
export type GrantablePermission = z.infer<typeof grantablePermissionSchema>;

// POST /members/invite
export const inviteMemberSchema = z.object({
  email: z.email(),
  permissions: z.array(grantablePermissionSchema),
});
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

// A membership's real join date, distinct from when its row was created —
// see memberships.ts's memberSince comment. Reused across every input that
// lets an admin assert a date rather than defaulting to today.
export const memberSinceSchema = z.iso.date();

// POST /members/placeholder — a member added by name only, with no login.
// `memberSince` defaults to today on the frontend but can be backdated,
// same as an Excel-imported row.
export const addPlaceholderMemberSchema = z.object({
  name: personNameSchema,
  memberSince: memberSinceSchema,
});
export type AddPlaceholderMemberInput = z.infer<typeof addPlaceholderMemberSchema>;

// POST /members/:membershipId/invite-login — attaches a real login to an
// existing placeholder membership. No permissions field: the membership
// already has whatever permissions it was given, this only ever changes
// how its owner can sign in.
export const inviteLoginSchema = z.object({
  email: z.email(),
});
export type InviteLoginInput = z.infer<typeof inviteLoginSchema>;

// PATCH /members/:membershipId/permissions
export const updateMemberPermissionsSchema = z.object({
  permissions: z.array(grantablePermissionSchema),
});
export type UpdateMemberPermissionsInput = z.infer<typeof updateMemberPermissionsSchema>;

// PATCH /members/:membershipId/reminders — whether this member gets the
// daily contribution-reminder cron's emails (see
// ContributionReminderService). A personal preference a member sets for
// themselves, not an admin lever — independent of permissions/removal.
export const updateReminderPauseSchema = z.object({ paused: z.boolean() });
export type UpdateReminderPauseInput = z.infer<typeof updateReminderPauseSchema>;

// PATCH /members/:membershipId/digest — same shape and the same
// self-only rule as updateReminderPauseSchema above, but for the monthly
// cooperative-wide digest (see MonthlyDigestService) rather than personal
// payment reminders.
export const updateDigestPauseSchema = z.object({ paused: z.boolean() });
export type UpdateDigestPauseInput = z.infer<typeof updateDigestPauseSchema>;

export const membershipIdParamSchema = z.object({ membershipId: z.uuid() });
export type MembershipIdParam = z.infer<typeof membershipIdParamSchema>;

export const membershipInviteIdParamSchema = z.object({ id: z.uuid() });
export type MembershipInviteIdParam = z.infer<typeof membershipInviteIdParamSchema>;

export const inviteTokenParamSchema = z.object({ token: z.string().min(1) });
export type InviteTokenParam = z.infer<typeof inviteTokenParamSchema>;

// GET /members/invites/lookup — public, read-only, safe to call on every
// page load/reload (unlike accept, this never consumes the invite). See
// docs/plans/invite-accept-rework.md: this is what lets /invite/accept show
// a clean "already used"/"expired" state instead of erroring on reload, and
// what a future notifications/workspace-selection surface would read from.
// `hasAccount` isn't an enumeration leak — the caller already needed the
// high-entropy token (which only ever reached them by email) to ask.
export const inviteLookupResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('pending'),
    email: z.email(),
    tenantName: z.string(),
    hasAccount: z.boolean(),
    // True when this invite attaches a login to an existing placeholder
    // member rather than creating a brand-new one — drives /invite/accept
    // showing "Claim your account for {name}" instead of "Create your
    // account to join", with the name field pre-filled from that member's
    // current placeholder name.
    isClaim: z.boolean(),
    claimName: z.string().nullable(),
  }),
  z.object({ status: z.literal('expired') }),
  z.object({ status: z.literal('consumed') }),
  z.object({ status: z.literal('invalid') }),
]);
export type InviteLookupResult = z.infer<typeof inviteLookupResultSchema>;

// POST /members/invites/accept — public, no session. Only ever reached for
// the "no account exists yet" case (see MembersService.acceptInvite) — an
// existing-account invitee logs in and hits POST /members/invites/:token/join
// instead, so password is always required here now.
export const acceptInviteSchema = z.object({
  token: z.string().min(1),
  name: personNameSchema,
  password: passwordSchema,
});
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;

// GET /members — active memberships and pending invites in one list (see
// the plan doc's reasoning: one place to see "who's in this cooperative"
// regardless of status, not a separate tab per status).
export const activeMemberSchema = z.object({
  status: z.literal('active'),
  membershipId: z.uuid(),
  userId: z.uuid(),
  name: z.string(),
  email: z.email(),
  // False for a placeholder member (added by name only, or imported
  // without an email column) — their `email` above is a synthetic,
  // non-deliverable address the frontend must never display as a real
  // contact (see users.ts's claimedAt). Becomes true once someone accepts
  // a claim-login invite for them.
  hasLogin: z.boolean(),
  permissions: z.array(z.string()),
  joinedAt: z.iso.datetime(),
  memberSince: memberSinceSchema,
  remindersPausedAt: z.iso.datetime().nullable(),
  digestPausedAt: z.iso.datetime().nullable(),
});
export type ActiveMember = z.infer<typeof activeMemberSchema>;

// "Expired" is a presentation-layer distinction, not a separate stored
// state — the API always reports 'invited' for any row in
// membership_invites with consumedAt still null; the frontend derives an
// expired display state itself by comparing expiresAt to the current time.
export const pendingInviteSchema = z.object({
  status: z.literal('invited'),
  inviteId: z.uuid(),
  email: z.email(),
  permissions: z.array(z.string()),
  invitedByUserId: z.uuid(),
  invitedAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
});
export type PendingInvite = z.infer<typeof pendingInviteSchema>;

// A removed member stays visible in the same list rather than
// disappearing — their history is still real and still explainable (see
// MembersService.list) — but carries none of an active member's levers:
// no permissions to edit, no reminders preference, nothing else can act
// on their behalf. `permissions` is what they held right before removal,
// kept for context, not because it still applies to anything.
export const removedMemberSchema = z.object({
  status: z.literal('removed'),
  membershipId: z.uuid(),
  userId: z.uuid(),
  name: z.string(),
  email: z.email(),
  hasLogin: z.boolean(),
  permissions: z.array(z.string()),
  joinedAt: z.iso.datetime(),
  memberSince: memberSinceSchema,
  removedAt: z.iso.datetime(),
});
export type RemovedMember = z.infer<typeof removedMemberSchema>;

export const memberListItemSchema = z.discriminatedUnion('status', [
  activeMemberSchema,
  pendingInviteSchema,
  removedMemberSchema,
]);
export type MemberListItem = z.infer<typeof memberListItemSchema>;

export const memberListResponseSchema = z.object({
  members: z.array(memberListItemSchema),
});
export type MemberListResponse = z.infer<typeof memberListResponseSchema>;

// POST /members/import/preview — multipart upload, the file itself isn't
// Zod-validated (Nest's FileInterceptor handles that); this is the shape
// of what comes back so the frontend can render a column-mapping form
// without a second upload.
export const memberImportPreviewSchema = z.object({
  columns: z.array(z.string()),
  sampleRows: z.array(z.array(z.string())),
});
export type MemberImportPreview = z.infer<typeof memberImportPreviewSchema>;

// POST /members/import — the mapping fields sent alongside the re-uploaded
// file (multipart text fields, not a JSON body). `nameColumns` is ordered
// and non-empty — one column, or several to join with a space, for a
// "first name" + "last name" style sheet. `emailColumn` is undefined when
// the sheet has no email column at all: every row then becomes a
// placeholder member instead of an invite.
export const memberImportMappingSchema = z.object({
  nameColumns: z.array(z.number().int().nonnegative()).min(1),
  emailColumn: z.number().int().nonnegative().optional(),
  memberSince: memberSinceSchema,
});
export type MemberImportMapping = z.infer<typeof memberImportMappingSchema>;

// One outcome per data row — never a silent partial success (see
// MembersService.importMembers).
export const memberImportRowResultSchema = z.discriminatedUnion('outcome', [
  z.object({ outcome: z.literal('invited'), row: z.number().int(), name: z.string(), email: z.email() }),
  z.object({ outcome: z.literal('added'), row: z.number().int(), name: z.string() }),
  z.object({ outcome: z.literal('skipped'), row: z.number().int(), reason: z.string() }),
]);
export type MemberImportRowResult = z.infer<typeof memberImportRowResultSchema>;

export const memberImportResultSchema = z.object({
  rows: z.array(memberImportRowResultSchema),
});
export type MemberImportResult = z.infer<typeof memberImportResultSchema>;
