import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { getTableName, is } from 'drizzle-orm';
import { PgTable } from 'drizzle-orm/pg-core';
import postgres from 'postgres';

import { createDb, type Database } from './client.js';
import * as schema from './schema/index.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_FOLDER = path.join(dirname, '..', 'migrations');

export interface TestDatabase {
  db: Database;
  /** Drops the database and closes every connection to it. Call in afterAll. */
  teardown: () => Promise<void>;
}

// Spins up a fresh, uniquely-named database on the same Postgres server used
// for local dev (see docker-compose.yml), applies every real migration to
// it, and returns a teardown that drops it. Every test file that calls this
// gets a pristine schema, isolated both from dev data and from every other
// test file running in parallel — pass env.DATABASE_URL as `serverUrl`.
export async function createTestDatabase(serverUrl: string): Promise<TestDatabase> {
  const dbName = `milvaloop_test_${randomUUID().replace(/-/g, '')}`;

  const admin = postgres(serverUrl, { max: 1 });
  await admin.unsafe(`CREATE DATABASE "${dbName}"`);
  await admin.end();

  const testUrl = new URL(serverUrl);
  testUrl.pathname = `/${dbName}`;

  const db = createDb(testUrl.toString());
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });

  const teardown = async () => {
    await db.$client.end();
    const cleanupAdmin = postgres(serverUrl, { max: 1 });
    await cleanupAdmin.unsafe(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
    await cleanupAdmin.end();
  };

  return { db, teardown };
}

// Truncates every table this schema defines. Generic over whatever tables
// exist — new tables need no update here. Use in beforeEach/afterEach for
// isolation between test cases within the same file, cheaper than a fresh
// createTestDatabase() per test.
export async function resetDatabase(db: Database): Promise<void> {
  const tableNames = (Object.values(schema).filter((value) => is(value, PgTable)) as PgTable[]).map(
    (table) => `"${getTableName(table)}"`,
  );

  if (tableNames.length === 0) {
    return;
  }

  await db.execute(`TRUNCATE TABLE ${tableNames.join(', ')} RESTART IDENTITY CASCADE`);
}
