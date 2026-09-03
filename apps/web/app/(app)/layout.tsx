'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { Separator } from '@milvaloop/ui/separator';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@milvaloop/ui/sidebar';
import { Skeleton } from '@milvaloop/ui/skeleton';
import { Typography } from '@milvaloop/ui/typography';

import { useCurrentSessionQuery } from '@/lib/auth/use-current-session';

import { AppSidebar } from './_components/app-sidebar';
import { BottomTabBar } from './_components/bottom-tab-bar';
import { usePageHeader } from './_components/page-headers';

// No middleware-level gate yet — the access token only ever lives in
// browser memory (see token-store.ts), so route protection here is a
// client-side redirect once the /auth/me query resolves, not a server-side
// check. Good enough while this is a single authenticated app shell; worth
// revisiting if a page here ever needs to avoid rendering its content
// server-side for a signed-out visitor.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, isPending, isError } = useCurrentSessionQuery();
  const pageHeader = usePageHeader();
  const isOnboardingRoute = pathname.startsWith('/onboarding');
  // The wizard itself links out to the real Members, historical-import,
  // and ledger pages to do the actual setup work (adding members,
  // backfilling contributions, approving what was just imported) rather
  // than duplicating them inline — those stay reachable without bouncing
  // back to /onboarding, unlike everything else. They're ordinary pages
  // once onboarding is done, though, so this only ever widens what's
  // reachable *before* completion — it must never feed the "already done,
  // get out of /onboarding" check below, or finishing setup would start
  // redirecting a normal visit to Members away from itself.
  const reachableDuringOnboarding =
    isOnboardingRoute ||
    pathname === '/members' ||
    pathname === '/members/import' ||
    pathname === '/contributions' ||
    pathname === '/contributions/import';

  useEffect(() => {
    if (!isPending && (isError || !session)) {
      router.replace('/auth/login');
    }
  }, [isPending, isError, session, router]);

  // A tenant with no guided setup finished yet is redirected into it on
  // every route until it is — and away from it once it's done, so a stale
  // /onboarding link never re-opens a wizard for a cooperative already up
  // and running (see AuthService.completeOnboarding).
  useEffect(() => {
    if (isPending || !session) {
      return;
    }
    if (!session.tenant.onboardedAt && !reachableDuringOnboarding) {
      router.replace('/onboarding');
    } else if (session.tenant.onboardedAt && isOnboardingRoute) {
      router.replace('/dashboard');
    }
  }, [isPending, session, reachableDuringOnboarding, isOnboardingRoute, router]);

  if (isPending || !session) {
    return (
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 px-4 py-12">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar
        tenantId={session.tenant.id}
        tenantName={session.tenant.name}
        cooperatives={session.cooperatives}
        name={session.user.name}
      />
      <SidebarInset>
        {/* Sticky and translucent below md — a fixed nav bar riding above
            scrolling content is the native pattern; above md the sidebar
            already gives that persistent orientation, so the header stays
            a plain, static part of the page like before. */}
        <header className="bg-background/85 supports-[backdrop-filter]:backdrop-blur-md sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b px-4 md:static md:h-20 md:bg-background md:backdrop-blur-none">
          {/* Opening the sidebar's own drawer is a desktop/tablet-rail
              affordance now — below md there's nothing to trigger, the
              bottom tab bar is the sole nav. */}
          <SidebarTrigger className="hidden md:flex" />
          <Separator orientation="vertical" className="hidden h-4 md:block" />
          {pageHeader ? (
            <div className="flex min-w-0 flex-col justify-center">
              <Typography as="h1" variant="h3">
                {pageHeader.title}
              </Typography>
              <Typography variant="muted" className="hidden truncate sm:block">
                {pageHeader.description}
              </Typography>
            </div>
          ) : null}
        </header>
        {/* No max-width here — a data table (Members) needs the room a
            narrow, form-like page (Dashboard, Account) doesn't. Pages that
            want the narrower look wrap their own content in max-w-2xl.
            Extra bottom padding on mobile clears the fixed tab bar (see
            BottomTabBar) rather than letting a page's last few pixels sit
            underneath it. */}
        <main className="flex-1 px-4 pt-8 pb-24 md:pb-8">{children}</main>
      </SidebarInset>
      <BottomTabBar />
    </SidebarProvider>
  );
}
