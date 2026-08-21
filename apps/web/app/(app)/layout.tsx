'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@milvaloop/ui/button';
import { Skeleton } from '@milvaloop/ui/skeleton';
import { ThemeToggle } from '@milvaloop/ui/theme-toggle';
import { Typography } from '@milvaloop/ui/typography';

import { useLogoutMutation } from '@/lib/auth/use-auth-mutations';
import { useCurrentSessionQuery } from '@/lib/auth/use-current-session';

import { CooperativeSwitcher } from './_components/cooperative-switcher';

// No middleware-level gate yet — the access token only ever lives in
// browser memory (see token-store.ts), so route protection here is a
// client-side redirect once the /auth/me query resolves, not a server-side
// check. Good enough while this is a single authenticated app shell; worth
// revisiting if a page here ever needs to avoid rendering its content
// server-side for a signed-out visitor.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data: session, isPending, isError } = useCurrentSessionQuery();
  const logout = useLogoutMutation();

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

  async function handleLogout() {
    await logout.mutateAsync();
    router.push('/auth/login');
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b px-4 py-3">
        {session.cooperatives.length > 1 ? (
          <CooperativeSwitcher currentTenantId={session.tenant.id} cooperatives={session.cooperatives} />
        ) : (
          <Typography variant="large">{session.tenant.name}</Typography>
        )}
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="ghost" onClick={handleLogout}>
            Log out
          </Button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
