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
import { applyServerError } from '@/lib/forms/apply-server-error';
import { useAcceptInviteMutation } from '@/lib/members/use-members-mutations';

// A blank password means "I already have a MilvaLoop account, just add this
// cooperative to it" — the server decides which case it is by looking up the
// invited email (see MembersService.acceptInvite); the client can't know in
// advance, so the field stays optional and the server's own "password is
// required" rejection (surfaced as a plain page-level error, same as any
// other applyServerError case) is what tells a new invitee to fill it in.
const acceptInviteFormSchema = z.object({
  password: z.union([z.literal(''), passwordSchema]),
});
type AcceptInviteFormValues = z.infer<typeof acceptInviteFormSchema>;

function AcceptInviteForm() {
  const token = useSearchParams().get('token');
  const router = useRouter();
  const acceptInvite = useAcceptInviteMutation();
  const [formError, setFormError] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<CooperativeChallenge | null>(null);

  const form = useForm<AcceptInviteFormValues>({
    resolver: zodResolver(acceptInviteFormSchema),
    defaultValues: { password: '' },
  });

  async function onSubmit(values: AcceptInviteFormValues) {
    if (!token) {
      return;
    }
    setFormError(null);
    try {
      const result = await acceptInvite.mutateAsync({ token, password: values.password || undefined });
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

  if (!token) {
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Accept invite</CardTitle>
        <CardDescription>
          Set a password if you don&rsquo;t have a MilvaLoop account yet. Already have one? Leave it blank.
        </CardDescription>
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
              {form.formState.isSubmitting ? 'Accepting…' : 'Accept invite'}
            </Button>
          </form>
        </Form>
        <p className="text-muted-foreground mt-4 text-center text-sm">
          <Link href="/auth/login" className="text-primary underline-offset-4 hover:underline">
            Log in instead
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<Skeleton className="h-40 w-full" />}>
      <AcceptInviteForm />
    </Suspense>
  );
}
