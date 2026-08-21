export * from './client.js';
export * as schema from './schema/index.js';

// Re-exported so consumers never need their own `drizzle-orm` dependency —
// importing it in two places in the same dependency chain causes a
// type-identity hazard (the same class resolved two ways stops structurally
// matching itself). This package is the one place that depends on it.
export { and, eq, gt } from 'drizzle-orm';
