import type { Database } from '@milvaloop/db';

// Drizzle's transaction callback parameter — accepted anywhere a plain
// Database is, so a function works both standalone (each call gets its own
// real transaction) and nested inside an existing transaction (becomes a
// real SAVEPOINT instead). Shared here now that AuthService and the members
// module both need it — previously duplicated as a local alias in
// auth.service.ts.
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
