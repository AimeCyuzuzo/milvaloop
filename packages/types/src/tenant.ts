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

// Shared by signupSchema and createCooperativeSchema so both derive the
// cooperative-name rule from one place instead of duplicating
// `z.string().min(1).max(255)` (255 matches the tenants.name column).
export const cooperativeNameSchema = z.string().min(1).max(255);

// The safe subset of a tenant a user is allowed to see about their OWN
// other memberships (login's cooperative picker, the dashboard switcher) —
// never createdAt or anything about other members.
export const cooperativeSummarySchema = tenantSchema.omit({ createdAt: true });
export type CooperativeSummary = z.infer<typeof cooperativeSummarySchema>;

// Derives the default address (tenantSlugSchema-shaped) from a cooperative
// name — lowercase, diacritics stripped, words joined by single hyphens.
// This is never user-edited (see docs/BACKLOG.md); a user only ever sees it
// as an info preview (AuthService.previewCooperativeSlug) or on the tenant
// that actually got created (AuthService.insertTenantAndMembership, which
// re-derives it server-side rather than trusting the preview).
export function slugify(name: string): string {
  const base = name
    .normalize('NFKD')
    .replace(/\p{M}/gu, '') // strip diacritics (é -> e, etc.) left behind by NFKD
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    // Leaves headroom for a "-<n>" disambiguation suffix (see
    // AuthService.insertTenantAndMembership) while staying well under
    // tenantSlugSchema's 63-character cap.
    .slice(0, 55)
    .replace(/-+$/, '');
  return base.length >= 2 ? base : 'cooperative';
}

// GET /cooperatives/slug-preview — shown as read-only info while typing a
// cooperative name, never an editable field.
export const slugPreviewQuerySchema = z.object({ name: cooperativeNameSchema });
export type SlugPreviewQuery = z.infer<typeof slugPreviewQuerySchema>;

export const slugPreviewResultSchema = z.object({ slug: tenantSlugSchema });
export type SlugPreviewResult = z.infer<typeof slugPreviewResultSchema>;
