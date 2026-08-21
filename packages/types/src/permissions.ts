// A membership's `permissions` array is the least-privilege list checked on
// the backend on every protected route (see CODE_QUALITY.md). The founder
// of a tenant (the person who signed up and created it) is granted
// TENANT_ADMIN, which acts as a blanket override — both PermissionsGuard
// (backend) and useHasPermission (frontend) treat "has TENANT_ADMIN" as
// satisfying any specific permission check, so an admin's membership only
// ever needs that one flag. Don't add a permission string that no route
// actually checks yet.
export const PERMISSIONS = {
  TENANT_ADMIN: 'tenant:admin',
  MEMBERS_INVITE: 'members:invite',
  MEMBERS_EDIT: 'members:edit',
  MEMBERS_REMOVE: 'members:remove',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
