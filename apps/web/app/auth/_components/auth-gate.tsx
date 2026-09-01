'use client';

import { Suspense, useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { Skeleton } from '@milvaloop/ui/skeleton';

import { useCurrentSessionQuery } from '@/lib/auth/use-current-session';
import { getSafeRedirectTarget } from '@/lib/navigation/redirect-target';

// Most pages under app/auth/* are for someone who isn't authenticated yet.
// An already-authenticated visitor landing on one (a stale login tab, a
// bookmarked link, or bouncing back from a `?redirect=` round-trip) should
// go straight into the app instead of seeing a login form — the reverse of
// (app)/layout.tsx's "not authenticated → send to login" redirect.
//
// verify-email doesn't fit that assumption: confirming an email address is
// a fact about the account, not a way to log in, and the realistic path to
// it — click the link right after signing up — means the visitor is
// already authenticated in that same browser almost every time. Redirecting
// those visitors away here (as this gate otherwise would) meant the page's
// own verify call never ran, so the email was never actually marked
// verified despite landing back in the app looking like it worked.
const BYPASS_PATHS = ['/auth/verify-email'];

function AuthGateInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session, isPending } = useCurrentSessionQuery();
  const bypass = BYPASS_PATHS.includes(pathname);

  useEffect(() => {
    if (!bypass && !isPending && session) {
      router.replace(getSafeRedirectTarget(searchParams.get('redirect')));
    }
  }, [bypass, isPending, session, searchParams, router]);

  if (!bypass && (isPending || session)) {
    return <Skeleton className="h-40 w-full" />;
  }

  return <>{children}</>;
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<Skeleton className="h-40 w-full" />}>
      <AuthGateInner>{children}</AuthGateInner>
    </Suspense>
  );
}
