import type { Database } from '@milvaloop/db';

// Drizzle's transaction callback parameter — accepted anywhere a plain
// Database is, so a function works both standalone (each call gets its own
// real transaction) and nested inside an existing transaction (becomes a
// real SAVEPOINT instead). Lives here, not as a local alias in a single
// service file, because both AuthService and the members module need it.
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
