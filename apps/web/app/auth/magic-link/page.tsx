'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

import { Alert, AlertDescription } from '@milvaloop/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@milvaloop/ui/card';
import { Skeleton } from '@milvaloop/ui/skeleton';

import { CooperativeChallengeCard, type CooperativeChallenge } from '@/components/auth/cooperative-challenge';
import { useConsumeMagicLinkMutation } from '@/lib/auth/use-auth-mutations';
import { getSafeRedirectTarget } from '@/lib/navigation/redirect-target';

// Same branching as the login page (see LoginResult) — a magic link also
// only proves identity, not which cooperative to enter.
function MagicLinkConsumer() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const redirectTo = getSafeRedirectTarget(searchParams.get('redirect'));
  const router = useRouter();
  const consumeMagicLink = useConsumeMagicLinkMutation();
  const [error, setError] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<CooperativeChallenge | null>(null);
  const attempted = useRef(false);

  useEffect(() => {
    if (!token || attempted.current) {
      return;
    }
    attempted.current = true;

    consumeMagicLink
      .mutateAsync({ token })
      .then((result) => {
        if (result.status === 'authenticated') {
          router.replace(redirectTo);
        } else {
          setChallenge(result);
        }
      })
      .catch(() => setError('This link is invalid or has expired.'));
  }, [token, consumeMagicLink, router, redirectTo]);

  if (challenge) {
    return <CooperativeChallengeCard challenge={challenge} redirectTo={redirectTo} />;
  }

  if (!token) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Missing sign-in link</CardTitle>
          <CardDescription>
            Open this page from the link in your email, or{' '}
            <Link href="/auth/magic-link/request" className="text-primary underline-offset-4 hover:underline">
              request a new one
            </Link>
            .
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sign-in link expired</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Link href="/auth/magic-link/request" className="text-primary text-sm underline-offset-4 hover:underline">
            Request a new sign-in link
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Signing you in…</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </CardContent>
    </Card>
  );
}

export default function MagicLinkConsumePage() {
  return (
    <Suspense fallback={<Skeleton className="h-40 w-full" />}>
      <MagicLinkConsumer />
    </Suspense>
  );
}
