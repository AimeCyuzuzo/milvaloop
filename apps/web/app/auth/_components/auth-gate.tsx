'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { Skeleton } from '@milvaloop/ui/skeleton';

import { useCurrentSessionQuery } from '@/lib/auth/use-current-session';
import { getSafeRedirectTarget } from '@/lib/navigation/redirect-target';

// Every page under app/auth/* is for someone who isn't authenticated yet.
// An already-authenticated visitor landing here (a stale login tab, a
// bookmarked link, or bouncing back from a `?redirect=` round-trip) should
// go straight into the app instead of seeing a login form — the reverse of
// (app)/layout.tsx's "not authenticated → send to login" redirect.
function AuthGateInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, isPending } = useCurrentSessionQuery();

  useEffect(() => {
    if (!isPending && session) {
      router.replace(getSafeRedirectTarget(searchParams.get('redirect')));
    }
  }, [isPending, session, searchParams, router]);

  if (isPending || session) {
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
