'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { Separator } from '@milvaloop/ui/separator';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@milvaloop/ui/sidebar';
import { Skeleton } from '@milvaloop/ui/skeleton';
import { Typography } from '@milvaloop/ui/typography';

import { useCurrentSessionQuery } from '@/lib/auth/use-current-session';

import { AppSidebar } from './_components/app-sidebar';
import { usePageHeader } from './_components/page-headers';

// No middleware-level gate yet — the access token only ever lives in
// browser memory (see token-store.ts), so route protection here is a
// client-side redirect once the /auth/me query resolves, not a server-side
// check. Good enough while this is a single authenticated app shell; worth
// revisiting if a page here ever needs to avoid rendering its content
// server-side for a signed-out visitor.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data: session, isPending, isError } = useCurrentSessionQuery();
  const pageHeader = usePageHeader();

  useEffect(() => {
    if (!isPending && (isError || !session)) {
      router.replace('/auth/login');
    }
  }, [isPending, isError, session, router]);

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
        email={session.user.email}
      />
      <SidebarInset>
        <header className="flex h-20 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4" />
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
            want the narrower look wrap their own content in max-w-2xl. */}
        <main className="flex-1 px-4 py-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
