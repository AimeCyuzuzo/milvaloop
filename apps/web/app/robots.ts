import type { MetadataRoute } from 'next';

import { env } from '@/lib/env';
import { siteConfig } from '@/lib/site-config';

export default function robots(): MetadataRoute.Robots {
  const isProduction = env.NEXT_PUBLIC_SITE_ENV === 'production';

  return {
    rules: {
      userAgent: '*',
      allow: isProduction ? '/' : undefined,
      disallow: isProduction ? undefined : '/',
    },
    sitemap: isProduction ? `${siteConfig.url}/sitemap.xml` : undefined,
  };
}
