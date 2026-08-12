import type { MetadataRoute } from 'next';

import { siteConfig } from '@/lib/site-config';

export default function robots(): MetadataRoute.Robots {
  // Read directly rather than through the shared `env` object: this route
  // only needs NEXT_PUBLIC_SITE_ENV and must not fail the build over other,
  // unrelated web env vars being incomplete.
  const isProduction = process.env.NEXT_PUBLIC_SITE_ENV === 'production';

  return {
    rules: {
      userAgent: '*',
      allow: isProduction ? '/' : undefined,
      disallow: isProduction ? undefined : '/',
    },
    sitemap: isProduction ? `${siteConfig.url}/sitemap.xml` : undefined,
  };
}
