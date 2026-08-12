import Link from 'next/link';

import { Typography } from '@milvaloop/ui/typography';
import { siteConfig } from '@/lib/site-config';

const FOOTER_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/about', label: 'About' },
];

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Typography variant="muted">
            © {new Date().getFullYear()} {siteConfig.parentOrg.name}. All rights reserved.
          </Typography>

          <nav className="flex items-center gap-6">
            {FOOTER_LINKS.map((link) => (
              <Typography key={link.href} variant="muted" asChild>
                <Link href={link.href} className="hover:text-foreground">
                  {link.label}
                </Link>
              </Typography>
            ))}
          </nav>
        </div>

        <Typography variant="muted" className="mt-4">
          {siteConfig.name} is a product of{' '}
          <a
            href={siteConfig.parentOrg.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium underline underline-offset-4 hover:text-foreground"
          >
            {siteConfig.parentOrg.name}
          </a>
          .
        </Typography>
      </div>
    </footer>
  );
}
