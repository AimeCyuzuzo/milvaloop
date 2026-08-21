import { PERMISSIONS } from '@milvaloop/types';

import { usePermissions } from '@/lib/auth/use-permissions';

import { NAV_ITEMS } from './nav-items';

// No NAV_ITEMS entry needs a permission today (see nav-items.ts), so this
// is currently a no-op filter — it exists so the first nav item that does
// need one (e.g. a future admin-only settings page) is gated the same way
// every other permission check in this app already is, not bolted on later.
export function useVisibleNavItems() {
  const permissions = usePermissions();
  const isAdmin = permissions.includes(PERMISSIONS.TENANT_ADMIN);

  return NAV_ITEMS.filter((item) => !item.permission || isAdmin || permissions.includes(item.permission));
}
