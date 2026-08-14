// The `postgres` driver throws a plain object carrying the raw Postgres
// error fields (SQLSTATE code, constraint name, etc.), but drizzle-orm wraps
// that in its own DrizzleQueryError, moving the original onto `.cause`.
// Prefer catching a unique-violation from the constraint itself over a
// check-then-write pattern with a race gap (see CODE_QUALITY.md).
interface PostgresErrorLike {
  code?: string;
  constraint_name?: string;
  cause?: unknown;
}

const UNIQUE_VIOLATION = '23505';

export function isUniqueViolation(
  error: unknown,
  constraintName: string,
): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const pgError = error as PostgresErrorLike;
  if (
    pgError.code === UNIQUE_VIOLATION &&
    pgError.constraint_name === constraintName
  ) {
    return true;
  }
  return (
    pgError.cause !== undefined &&
    isUniqueViolation(pgError.cause, constraintName)
  );
}
