// Cooperative (tenant) slugs are user-chosen but must never collide with a
// system route, subdomain, or a name that could be confused for an official
// MilvaLoop/MilvaLabs surface (see .agents/rules/MAIN.md's "Reserved slugs"
// section). Kept in one place so signup validates identically wherever a
// slug is accepted.
export const RESERVED_SLUGS = [
  'www',
  'api',
  'app',
  'admin',
  'auth',
  'login',
  'logout',
  'signup',
  'signin',
  'register',
  'dashboard',
  'settings',
  'account',
  'billing',
  'help',
  'support',
  'status',
  'docs',
  'blog',
  'about',
  'pricing',
  'contact',
  'terms',
  'privacy',
  'legal',
  'mail',
  'email',
  'ftp',
  'assets',
  'static',
  'public',
  'milvaloop',
  'milvalabs',
  'null',
  'undefined',
  'test',
] as const;

export function isReservedSlug(slug: string): boolean {
  return (RESERVED_SLUGS as readonly string[]).includes(slug.toLowerCase());
}
