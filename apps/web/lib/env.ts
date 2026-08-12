import { loadEnv, webEnvSchema } from '@milvaloop/config';

export const env = loadEnv(webEnvSchema, {
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_SITE_ENV: process.env.NEXT_PUBLIC_SITE_ENV,
});
