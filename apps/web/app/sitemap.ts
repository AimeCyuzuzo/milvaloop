import type { MetadataRoute } from 'next';

import { siteConfig } from '@/lib/site-config';

const PUBLIC_ROUTES = ['', '/pricing', '/about'];

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_ROUTES.map((route) => ({
    url: `${siteConfig.url}${route}`,
    changeFrequency: 'monthly',
    priority: route === '' ? 1 : 0.8,
  }));
}
