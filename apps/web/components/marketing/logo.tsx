import Link from 'next/link';

import { Typography } from '@milvaloop/ui/typography';
import { siteConfig } from '@/lib/site-config';

// An open loop — literal to "MilvaLoop" — hand-drawn like the site's other
// custom SVG accents (see (public)/_components/decorative-svgs.tsx) rather
// than a stock icon. A placeholder brand mark: swap the path once a real
// logo exists.
function LogoMark({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 32 32" fill="none" className={className}>
      <path
        d="M16 6a10 10 0 1 0 7.5 16.8"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2">
      <LogoMark className="text-primary size-7" />
      <Typography variant="large">{siteConfig.name}</Typography>
    </Link>
  );
}
