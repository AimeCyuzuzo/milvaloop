import { SetMetadata } from '@nestjs/common';
import type { Permission } from '@milvaloop/types';

export const PERMISSIONS_KEY = 'requiredPermissions';

// Declares which permissions (see @milvaloop/types PERMISSIONS) a route
// requires. Only checked if the route is also behind PermissionsGuard —
// this decorator alone enforces nothing.
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
