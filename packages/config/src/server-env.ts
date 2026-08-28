import { z } from 'zod';

export const serverEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3001),

  DATABASE_URL: z.url(),

  REDIS_URL: z.url(),

  MINIO_ENDPOINT: z.string().min(1),
  MINIO_PORT: z.coerce.number().default(9000),
  MINIO_USE_SSL: z.coerce.boolean().default(false),
  MINIO_ACCESS_KEY: z.string().min(1),
  MINIO_SECRET_KEY: z.string().min(1),
  MINIO_BUCKET: z.string().min(1).default('milvaloop'),

  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().default(1025),
  SMTP_FROM: z.string().min(1).default('MilvaLoop <no-reply@milvaloop.local>'),
  // Mailpit needs neither (dev-only, no real mail server behind it) — every
  // real SMTP provider does, so these stay optional rather than required,
  // and the mailer only authenticates when both are actually set.
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASSWORD: z.string().min(1).optional(),
  // Implicit TLS (port 465) vs. STARTTLS (587, negotiated after connecting
  // in plaintext) — nodemailer's own `secure` flag distinguishes them, and
  // most providers (Resend included) expect STARTTLS, hence the default.
  SMTP_SECURE: z.coerce.boolean().default(false),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  // Signs short-lived tickets (e.g. "pick a cooperative after login") that
  // prove identity without being a real access/refresh token — kept on its
  // own secret so one can never be mistaken for the other even if a
  // purpose-claim check were ever skipped somewhere.
  AUTH_TICKET_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),

  COOKIE_DOMAIN: z.string().min(1),
  WEB_ORIGIN: z.url(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
