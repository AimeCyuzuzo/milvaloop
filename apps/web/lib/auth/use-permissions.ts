import { PERMISSIONS, type Permission } from '@milvaloop/types';

import { useCurrentSessionQuery } from './use-current-session';

// Mirrors PermissionsGuard on the backend exactly: TENANT_ADMIN is a
// blanket override, not one permission among equals — this is UX only
// (which buttons/nav links render), never the actual enforcement, which
// every backend route already does independently.
export function usePermissions(): Permission[] {
  const { data } = useCurrentSessionQuery();
  return (data?.permissions as Permission[] | undefined) ?? [];
}

export function useHasPermission(permission: Permission): boolean {
  const permissions = usePermissions();
  return permissions.includes(PERMISSIONS.TENANT_ADMIN) || permissions.includes(permission);
}
