import { z } from 'zod';

import { passwordSchema } from './auth.js';
import { PERMISSIONS, type Permission } from './permissions.js';

const NON_ADMIN_PERMISSIONS = Object.values(PERMISSIONS).filter(
  (permission) => permission !== PERMISSIONS.TENANT_ADMIN,
) as Exclude<Permission, typeof PERMISSIONS.TENANT_ADMIN>[];

// TENANT_ADMIN is deliberately excluded — granting full admin access is a
// separate, more deliberate action than the default invite/edit-permissions
// flow this schema backs (see docs/plans/members-management.md). No
// "promote to admin" flow exists yet; when one is built, it needs its own
// endpoint outside this schema, not a checkbox added here.
export const grantablePermissionSchema = z.enum(NON_ADMIN_PERMISSIONS);

// POST /members/invite
export const inviteMemberSchema = z.object({
  email: z.email(),
  permissions: z.array(grantablePermissionSchema),
});
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

// PATCH /members/:membershipId/permissions
export const updateMemberPermissionsSchema = z.object({
  permissions: z.array(grantablePermissionSchema),
});
export type UpdateMemberPermissionsInput = z.infer<typeof updateMemberPermissionsSchema>;

export const membershipIdParamSchema = z.object({ membershipId: z.uuid() });
export type MembershipIdParam = z.infer<typeof membershipIdParamSchema>;

export const membershipInviteIdParamSchema = z.object({ id: z.uuid() });
export type MembershipInviteIdParam = z.infer<typeof membershipInviteIdParamSchema>;

// POST /members/invites/accept — public, no session yet. `password` is
// required only when `email` doesn't already have an account; that's a
// database lookup, not something Zod can express, so the controller
// enforces it as business logic against one shape rather than branching
// across two schemas.
export const acceptInviteSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema.optional(),
});
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;

// GET /members — active memberships and pending invites in one list (see
// the plan doc's reasoning: one place to see "who's in this cooperative"
// regardless of status, not a separate tab per status).
export const activeMemberSchema = z.object({
  status: z.literal('active'),
  membershipId: z.uuid(),
  userId: z.uuid(),
  email: z.email(),
  permissions: z.array(z.string()),
  joinedAt: z.iso.datetime(),
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

export const memberListItemSchema = z.discriminatedUnion('status', [activeMemberSchema, pendingInviteSchema]);
export type MemberListItem = z.infer<typeof memberListItemSchema>;

export const memberListResponseSchema = z.object({
  members: z.array(memberListItemSchema),
});
export type MemberListResponse = z.infer<typeof memberListResponseSchema>;
