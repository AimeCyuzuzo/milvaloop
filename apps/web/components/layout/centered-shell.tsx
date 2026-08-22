import Link from 'next/link';

import { Typography } from '@milvaloop/ui/typography';

import { siteConfig } from '@/lib/site-config';

// The logo-over-a-single-narrow-card frame shared by every unauthenticated,
// single-purpose page: the auth flows (login, signup, ...) and the public
// invite-accept page. Anything that needs the full app shell (nav, session)
// belongs under (app), not here.
export function CenteredShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-12">
      <Link href="/">
        <Typography variant="large">{siteConfig.name}</Typography>
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
