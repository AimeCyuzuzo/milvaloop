'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';

import { Button } from '@milvaloop/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@milvaloop/ui/card';
import { Skeleton } from '@milvaloop/ui/skeleton';

import { CURRENT_SESSION_QUERY_KEY } from '@/lib/auth/use-current-session';
import { useVerifyEmailMutation } from '@/lib/auth/use-auth-mutations';

function EmailVerifier() {
  const token = useSearchParams().get('token');
  const verifyEmail = useVerifyEmailMutation();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<'pending' | 'success' | 'error'>('pending');
  const attempted = useRef(false);

  useEffect(() => {
    if (!token || attempted.current) {
      return;
    }
    attempted.current = true;

    verifyEmail
      .mutateAsync({ token })
      .then(() => {
        setStatus('success');
        // The current session (if any) now has emailVerified: true.
        void queryClient.invalidateQueries({ queryKey: CURRENT_SESSION_QUERY_KEY });
      })
      .catch(() => setStatus('error'));
  }, [token, verifyEmail, queryClient]);

  if (!token || status === 'error') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Verification link invalid</CardTitle>
          <CardDescription>This link is invalid or has expired.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/dashboard">Go to dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (status === 'success') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Email verified</CardTitle>
          <CardDescription>Your email address has been confirmed.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/dashboard">Go to dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Verifying your email…</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </CardContent>
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<Skeleton className="h-40 w-full" />}>
      <EmailVerifier />
    </Suspense>
  );
}
