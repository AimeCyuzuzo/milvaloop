import { z } from 'zod';

export const tenantSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  slug: z.string().min(1),
  createdAt: z.iso.datetime(),
});

export type Tenant = z.infer<typeof tenantSchema>;
