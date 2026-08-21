'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { loginSchema, type LoginInput } from '@milvaloop/types';

import { Alert, AlertDescription } from '@milvaloop/ui/alert';
import { Button } from '@milvaloop/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@milvaloop/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@milvaloop/ui/form';
import { Input } from '@milvaloop/ui/input';
import { Skeleton } from '@milvaloop/ui/skeleton';

import { CooperativeChallengeCard, type CooperativeChallenge } from '@/components/auth/cooperative-challenge';
import { applyServerError } from '@/lib/forms/apply-server-error';
import { useLoginMutation } from '@/lib/auth/use-auth-mutations';
import { getSafeRedirectTarget } from '@/lib/navigation/redirect-target';

// Login resolves to one of three outcomes (see LoginResult) once the
// password checks out: straight in, pick from several, or create a first
// one. All three render in place here — the ticket only exists as mutation
// result state, so round-tripping it through a route would mean putting it
// in a URL (leaks into history) for no benefit. A `?redirect=` param (e.g.
// from an invite link that sent an unauthenticated visitor here first)
// takes over from the default /dashboard landing spot on success.
function LoginForm() {
  const router = useRouter();
  const redirectTo = getSafeRedirectTarget(useSearchParams().get('redirect'));
  const login = useLoginMutation();
  const [formError, setFormError] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<CooperativeChallenge | null>(null);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(values: LoginInput) {
    setFormError(null);
    try {
      const result = await login.mutateAsync(values);
      if (result.status === 'authenticated') {
        router.push(redirectTo);
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
    return <CooperativeChallengeCard challenge={challenge} redirectTo={redirectTo} />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Log in</CardTitle>
        <CardDescription>Sign in to MilvaLoop.</CardDescription>
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
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" autoComplete="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>Password</FormLabel>
                    <Link
                      href="/auth/forgot-password"
                      className="text-muted-foreground text-sm underline-offset-4 hover:underline"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <FormControl>
                    <Input type="password" autoComplete="current-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Logging in…' : 'Log in'}
            </Button>
          </form>
        </Form>
        <p className="text-muted-foreground mt-4 text-center text-sm">
          <Link href="/auth/magic-link/request" className="text-primary underline-offset-4 hover:underline">
            Email me a sign-in link instead
          </Link>
        </p>
        <p className="text-muted-foreground mt-2 text-center text-sm">
          Need a cooperative?{' '}
          <Link href="/auth/signup" className="text-primary underline-offset-4 hover:underline">
            Create one
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<Skeleton className="h-40 w-full" />}>
      <LoginForm />
    </Suspense>
  );
}
