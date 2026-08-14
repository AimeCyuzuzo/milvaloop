import { createHash, randomBytes } from 'node:crypto';

// Refresh tokens and magic-link tokens are opaque, high-entropy random
// values (256 bits) rather than low-entropy secrets like passwords — a
// plain SHA-256 digest of a value that large is already computationally
// infeasible to reverse, so no memory-hard KDF (argon2) is needed here.
// Only the hash is ever persisted; the raw token lives in the httpOnly
// cookie or the emailed link.
export function generateOpaqueToken(): string {
  return randomBytes(32).toString('hex');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

const DURATION_UNITS: Record<string, number> = {
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

// Parses the small subset of duration strings used by JWT_ACCESS_TTL /
// JWT_REFRESH_TTL (e.g. "15m", "30d") into milliseconds.
export function parseTtlMs(ttl: string): number {
  const match = /^(\d+)(s|m|h|d)$/.exec(ttl.trim());
  if (!match) {
    throw new Error(`Invalid TTL format: "${ttl}"`);
  }
  const [, amount, unit] = match;
  return Number(amount) * DURATION_UNITS[unit];
}

// jsonwebtoken's `expiresIn` takes a plain number as whole seconds — this
// avoids fighting its string-literal-typed `StringValue` overload for a
// value we only know as `string` at compile time (it comes from env.ts).
export function parseTtlSeconds(ttl: string): number {
  return Math.floor(parseTtlMs(ttl) / 1000);
}
