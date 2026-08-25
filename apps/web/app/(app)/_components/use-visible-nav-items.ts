import { PERMISSIONS } from '@milvaloop/types';

import { usePermissions } from '@/lib/auth/use-permissions';

import { NAV_ITEMS } from './nav-items';

// Gates each nav item the same way every other permission check in this
// app works: TENANT_ADMIN is a blanket override, an item with no
// `permission` is always visible, and one with a permission needs it.
export function useVisibleNavItems() {
  const permissions = usePermissions();
  const isAdmin = permissions.includes(PERMISSIONS.TENANT_ADMIN);

  return NAV_ITEMS.filter((item) => !item.permission || isAdmin || permissions.includes(item.permission));
}
