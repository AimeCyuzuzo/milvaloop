import { z } from 'zod';

import { isReservedSlug } from './reserved-slugs.js';

// Lowercase letters, numbers, and single hyphens between them — safe as a
// subdomain label and never reserved (see reserved-slugs.ts).
export const tenantSlugSchema = z
  .string()
  .min(2)
  .max(63)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use lowercase letters, numbers, and hyphens only')
  .refine((slug) => !isReservedSlug(slug), { message: 'This name is reserved' });

export const tenantSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  slug: tenantSlugSchema,
  createdAt: z.iso.datetime(),
});

export type Tenant = z.infer<typeof tenantSchema>;
