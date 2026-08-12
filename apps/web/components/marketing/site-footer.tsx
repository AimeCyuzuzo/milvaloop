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
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <Typography variant="muted">
          © {new Date().getFullYear()} {siteConfig.name}. All rights reserved.
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
    </footer>
  );
}
