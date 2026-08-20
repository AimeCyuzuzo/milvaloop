'use client';

import Link from 'next/link';
import { toast } from 'sonner';

import { Alert, AlertDescription, AlertTitle } from '@milvaloop/ui/alert';
import { Button } from '@milvaloop/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@milvaloop/ui/card';

import { useResendVerificationMutation } from '@/lib/auth/use-auth-mutations';
import { useCurrentSessionQuery } from '@/lib/auth/use-current-session';

export default function DashboardPage() {
  const { data: session } = useCurrentSessionQuery();
  const resendVerification = useResendVerificationMutation();

  // AppLayout owns the redirect for a signed-out visitor — this just avoids
  // rendering with no session during that brief window.
  if (!session) {
    return null;
  }

  async function handleResend() {
    await resendVerification.mutateAsync(undefined);
    toast.success('If your email is not yet verified, a new link has been sent.');
  }

  return (
    <div className="flex flex-col gap-6">
      {!session.user.emailVerified ? (
        <Alert>
          <AlertTitle>Verify your email</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <span>Check your inbox for a verification link.</span>
            <Button
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={handleResend}
              disabled={resendVerification.isPending}
            >
              {resendVerification.isPending ? 'Sending…' : 'Resend verification email'}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{session.tenant.name}</CardTitle>
          <CardDescription>Signed in as {session.user.email}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/account">Account settings</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
