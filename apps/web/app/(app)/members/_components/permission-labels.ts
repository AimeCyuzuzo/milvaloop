import { PERMISSIONS, type Permission } from '@milvaloop/types';

// Plain, direct labels for every permission string. The invite dialog and
// edit sheet only ever render the GRANTABLE_PERMISSIONS subset (TENANT_ADMIN
// isn't a checkbox anyone can toggle there), but the members table's
// permissions column needs to display an admin's badge too, so this map
// covers all of PERMISSIONS.
export const PERMISSION_LABELS: Record<Permission, string> = {
  [PERMISSIONS.TENANT_ADMIN]: 'Admin',
  [PERMISSIONS.MEMBERS_INVITE]: 'Invite members',
  [PERMISSIONS.MEMBERS_EDIT]: 'Edit member permissions',
  [PERMISSIONS.MEMBERS_REMOVE]: 'Remove members',
};

// Permissions arrive over the wire as `string[]` (see @milvaloop/types'
// activeMemberSchema/pendingInviteSchema) rather than a validated Permission
// enum, so the members table can't index PERMISSION_LABELS directly without
// risking an unrecognized value. This is the one place that bridges the two,
// falling back to the raw string instead of crashing on it.
export function permissionLabel(permission: string): string {
  return permission in PERMISSION_LABELS ? PERMISSION_LABELS[permission as Permission] : permission;
}
