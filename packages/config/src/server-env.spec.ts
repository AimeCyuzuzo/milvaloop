import { describe, expect, it } from 'vitest';

import { serverEnvSchema } from './server-env.js';

// Every value read from process.env arrives as a string — the specific
// regression this guards against is z.coerce.boolean() silently doing
// Boolean('false') (true, since it's a non-empty string) instead of
// actually parsing the word "false". SMTP_SECURE and MINIO_USE_SSL both
// went through exactly this bug once already (see the commit that added
// this file): a config file correctly saying "false" produced a real TLS
// handshake mismatch (implicit TLS attempted against a STARTTLS-only
// port) because the app read it as true.
const BASE_ENV = {
  DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
  MINIO_ENDPOINT: 'localhost',
  MINIO_ACCESS_KEY: 'key',
  MINIO_SECRET_KEY: 'secret',
  SMTP_HOST: 'localhost',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  AUTH_TICKET_SECRET: 'c'.repeat(32),
  COOKIE_DOMAIN: 'localhost',
  WEB_ORIGIN: 'http://localhost:3000',
};

describe('serverEnvSchema', () => {
  it('parses SMTP_SECURE=false as the boolean false, not true', () => {
    const result = serverEnvSchema.parse({ ...BASE_ENV, SMTP_SECURE: 'false' });
    expect(result.SMTP_SECURE).toBe(false);
  });

  it('parses SMTP_SECURE=true as the boolean true', () => {
    const result = serverEnvSchema.parse({ ...BASE_ENV, SMTP_SECURE: 'true' });
    expect(result.SMTP_SECURE).toBe(true);
  });

  it('defaults SMTP_SECURE to false when unset', () => {
    const result = serverEnvSchema.parse(BASE_ENV);
    expect(result.SMTP_SECURE).toBe(false);
  });

  it('rejects an SMTP_SECURE value that is neither "true" nor "false"', () => {
    expect(() => serverEnvSchema.parse({ ...BASE_ENV, SMTP_SECURE: 'yes' })).toThrow();
  });

  it('parses MINIO_USE_SSL=false as the boolean false, not true', () => {
    const result = serverEnvSchema.parse({ ...BASE_ENV, MINIO_USE_SSL: 'false' });
    expect(result.MINIO_USE_SSL).toBe(false);
  });

  it('parses MINIO_USE_SSL=true as the boolean true', () => {
    const result = serverEnvSchema.parse({ ...BASE_ENV, MINIO_USE_SSL: 'true' });
    expect(result.MINIO_USE_SSL).toBe(true);
  });
});
