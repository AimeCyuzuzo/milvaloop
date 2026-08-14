// A membership's `permissions` array is the least-privilege list checked on
// the backend on every protected route (see CODE_QUALITY.md). Only one
// permission exists so far: the founder of a tenant (the person who signed
// up and created it) is granted TENANT_ADMIN. Extend this as real
// permission-gated features (contributions, members, etc.) are built —
// don't add a permission string that no route actually checks yet.
export const PERMISSIONS = {
  TENANT_ADMIN: 'tenant:admin',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
