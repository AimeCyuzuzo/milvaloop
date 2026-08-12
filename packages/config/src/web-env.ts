import { z } from 'zod';

export const webEnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z.url(),
  /** Set to "production" only in the real production deployment, so non-production deploys are excluded from search indexing. */
  NEXT_PUBLIC_SITE_ENV: z.enum(['development', 'preview', 'production']).default('development'),
});

export type WebEnv = z.infer<typeof webEnvSchema>;
