'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { passwordSchema } from '@milvaloop/types';
import { z } from 'zod';

import { Alert, AlertDescription } from '@milvaloop/ui/alert';
import { Button } from '@milvaloop/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@milvaloop/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@milvaloop/ui/form';
import { Input } from '@milvaloop/ui/input';
import { Skeleton } from '@milvaloop/ui/skeleton';

import { CooperativeChallengeCard, type CooperativeChallenge } from '@/components/auth/cooperative-challenge';
import { getErrorMessage } from '@/lib/api/api-fetch';
import { useLogoutMutation } from '@/lib/auth/use-auth-mutations';
import { useCurrentSessionQuery } from '@/lib/auth/use-current-session';
import { applyServerError } from '@/lib/forms/apply-server-error';
import { useInviteLookupQuery } from '@/lib/members/use-invite-lookup-query';
import { useAcceptInviteMutation, useJoinInviteMutation } from '@/lib/members/use-members-mutations';

// See docs/plans/invite-accept-rework.md for the full state breakdown this
// page renders. A read-only lookup (safe to call repeatedly, including on
// reload) decides which of six states to show; only an authenticated
// request whose email matches the invite, or a brand-new account, can
// ever join — an invite link is authorization to join a cooperative, not
// proof of identity.

function MissingInviteCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Missing invite link</CardTitle>
        <CardDescription>
          Open this page from the link in your invite email, or ask whoever invited you to send a new one.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}

function InviteStatusCard({ title, description }: { title: string; description: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
    </Card>
  );
}

function LogInToAcceptCard({ loginHref }: { loginHref: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Log in to accept this invite</CardTitle>
        <CardDescription>You already have a MilvaLoop account for this email.</CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild>
          <Link href={loginHref}>Log in</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function WrongAccountCard({
  invitedEmail,
  currentEmail,
  loginHref,
}: {
  invitedEmail: string;
  currentEmail: string;
  loginHref: string;
}) {
  const router = useRouter();
  const logout = useLogoutMutation();

  async function handleLogout() {
    await logout.mutateAsync();
    router.push(loginHref);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Wrong account</CardTitle>
        <CardDescription>
          This invite was sent to {invitedEmail}, but you&rsquo;re logged in as {currentEmail}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="outline" onClick={handleLogout} disabled={logout.isPending}>
          Log out
        </Button>
      </CardContent>
    </Card>
  );
}

function AcceptAsCurrentUserCard({ token, tenantName }: { token: string; tenantName: string }) {
  const router = useRouter();
  const join = useJoinInviteMutation();
  const [error, setError] = useState<string | null>(null);

  async function handleAccept() {
    setError(null);
    try {
      await join.mutateAsync(token);
      router.push('/dashboard');
    } catch (caught) {
      setError(getErrorMessage(caught));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Join {tenantName}</CardTitle>
        <CardDescription>You&rsquo;ve been invited to join this cooperative.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <Button onClick={handleAccept} disabled={join.isPending} className="w-fit">
          {join.isPending ? 'Joining…' : 'Accept invite'}
        </Button>
      </CardContent>
    </Card>
  );
}

const createAccountFormSchema = z.object({ password: passwordSchema });
type CreateAccountFormValues = z.infer<typeof createAccountFormSchema>;

function CreateAccountToJoinCard({ token, email, tenantName }: { token: string; email: string; tenantName: string }) {
  const router = useRouter();
  const acceptInvite = useAcceptInviteMutation();
  const [formError, setFormError] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<CooperativeChallenge | null>(null);

  const form = useForm<CreateAccountFormValues>({
    resolver: zodResolver(createAccountFormSchema),
    defaultValues: { password: '' },
  });

  async function onSubmit(values: CreateAccountFormValues) {
    setFormError(null);
    try {
      const result = await acceptInvite.mutateAsync({ token, ...values });
      if (result.status === 'authenticated') {
        router.push('/dashboard');
      } else {
        setChallenge(result);
      }
    } catch (error) {
      const message = applyServerError(form, error);
      if (message) {
        setFormError(message);
      }
    }
  }

  if (challenge) {
    return <CooperativeChallengeCard challenge={challenge} />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your account to join {tenantName}</CardTitle>
        <CardDescription>{email}</CardDescription>
      </CardHeader>
      <CardContent>
        {formError ? (
          <div className="mb-4">
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          </div>
        ) : null}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Creating account…' : 'Create account and join'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

function AcceptInviteFlow() {
  const token = useSearchParams().get('token');
  const lookup = useInviteLookupQuery(token);
  const { data: session, isPending: sessionPending, isError: sessionError } = useCurrentSessionQuery();

  if (!token) {
    return <MissingInviteCard />;
  }

  if (lookup.isPending || sessionPending) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading invite…</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </CardContent>
      </Card>
    );
  }

  if (lookup.isError || !lookup.data || lookup.data.status === 'invalid') {
    return <InviteStatusCard title="Invalid invite" description="This invite link is invalid." />;
  }
  if (lookup.data.status === 'expired') {
    return (
      <InviteStatusCard
        title="Invite expired"
        description="This invite has expired — ask whoever invited you to send a new one."
      />
    );
  }

  const authenticatedSession = !sessionError && session ? session : null;
  const loginHref = `/auth/login?redirect=${encodeURIComponent(`/invite/accept?token=${token}`)}`;

  if (lookup.data.status === 'consumed') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Invite already used</CardTitle>
          <CardDescription>This invite has already been accepted.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href={authenticatedSession ? '/dashboard' : '/auth/login'}>
              {authenticatedSession ? 'Go to dashboard' : 'Log in'}
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { email, tenantName, hasAccount } = lookup.data;

  if (!authenticatedSession) {
    if (hasAccount) {
      return <LogInToAcceptCard loginHref={loginHref} />;
    }
    return <CreateAccountToJoinCard token={token} email={email} tenantName={tenantName} />;
  }

  if (authenticatedSession.user.email !== email) {
    return <WrongAccountCard invitedEmail={email} currentEmail={authenticatedSession.user.email} loginHref={loginHref} />;
  }

  return <AcceptAsCurrentUserCard token={token} tenantName={tenantName} />;
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<Skeleton className="h-40 w-full" />}>
      <AcceptInviteFlow />
    </Suspense>
  );
}
