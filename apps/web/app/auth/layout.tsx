import type { Metadata } from 'next';
import Link from 'next/link';

import { Typography } from '@milvaloop/ui/typography';

import { siteConfig } from '@/lib/site-config';

// Every page under here is a Client Component (react-hook-form, hooks), so
// none can export its own metadata — this is a placeholder default rather
// than the marketing homepage's tagline until they're split into a
// server/client pair each with a real per-page title.
export const metadata: Metadata = {
  // The root layout's title template already appends "— MilvaLoop".
  title: 'Sign in',
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-12">
      <Link href="/">
        <Typography variant="large">{siteConfig.name}</Typography>
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
