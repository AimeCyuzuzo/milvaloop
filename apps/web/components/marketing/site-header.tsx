import Link from 'next/link';

import { Button } from '@milvaloop/ui/button';
import { Typography } from '@milvaloop/ui/typography';
import { ThemeToggle } from '@milvaloop/ui/theme-toggle';
import { siteConfig } from '@/lib/site-config';

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/about', label: 'About' },
];

export function SiteHeader() {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Typography variant="large" asChild>
          <Link href="/">{siteConfig.name}</Link>
        </Typography>

        <nav className="hidden items-center gap-6 text-muted-foreground md:flex">
          {NAV_LINKS.map((link) => (
            <Typography key={link.href} variant="small" asChild>
              <Link href={link.href} className="hover:text-foreground">
                {link.label}
              </Link>
            </Typography>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="ghost" asChild>
            <Link href="/auth/login">Sign in</Link>
          </Button>
          <Button asChild>
            <Link href="/pricing">Start free trial</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
