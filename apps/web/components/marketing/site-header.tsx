import Link from 'next/link';

import { Button } from '@milvaloop/ui/button';
import { Typography } from '@milvaloop/ui/typography';
import { ThemeToggle } from '@milvaloop/ui/theme-toggle';

import { Logo } from './logo';

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/about', label: 'About' },
];

export function SiteHeader() {
  return (
    <header>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Logo />

        <nav className="bg-muted/50 hidden items-center gap-1 rounded-full p-1 md:flex">
          {NAV_LINKS.map((link) => (
            <Typography key={link.href} variant="small" asChild>
              <Link
                href={link.href}
                className="text-muted-foreground hover:text-foreground hover:bg-card rounded-full px-3 py-1.5"
              >
                {link.label}
              </Link>
            </Typography>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="ghost" asChild>
            <Link href="/auth/login">Log in</Link>
          </Button>
          <Button asChild>
            <Link href="/auth/signup">Get started</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
