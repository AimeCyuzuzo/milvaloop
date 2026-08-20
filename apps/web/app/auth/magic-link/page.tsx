'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { cooperativeNameSchema, type CooperativeSummary } from '@milvaloop/types';
import { z } from 'zod';

import { Alert, AlertDescription } from '@milvaloop/ui/alert';
import { Button } from '@milvaloop/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@milvaloop/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@milvaloop/ui/form';
import { Input } from '@milvaloop/ui/input';
import { Skeleton } from '@milvaloop/ui/skeleton';

import { CooperativeSlugPreview } from '@/components/cooperatives/slug-preview';
import { applyServerError } from '@/lib/forms/apply-server-error';
import {
  useConsumeMagicLinkMutation,
  useCreateFirstCooperativeMutation,
  useSelectCooperativeMutation,
} from '@/lib/auth/use-auth-mutations';

// Same branching as the login page (see LoginResult) — a magic link also
// only proves identity, not which cooperative to enter.
type Challenge =
  | { status: 'selection_required'; ticket: string; cooperatives: CooperativeSummary[] }
  | { status: 'no_cooperatives'; ticket: string };

function MagicLinkConsumer() {
  const token = useSearchParams().get('token');
  const router = useRouter();
  const consumeMagicLink = useConsumeMagicLinkMutation();
  const [error, setError] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
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
          router.replace('/dashboard');
        } else {
          setChallenge(result);
        }
      })
      .catch(() => setError('This link is invalid or has expired.'));
  }, [token, consumeMagicLink, router]);

  if (challenge?.status === 'selection_required') {
    return <SelectCooperativeCard ticket={challenge.ticket} cooperatives={challenge.cooperatives} />;
  }

  if (challenge?.status === 'no_cooperatives') {
    return <CreateFirstCooperativeCard ticket={challenge.ticket} />;
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

function SelectCooperativeCard({ ticket, cooperatives }: { ticket: string; cooperatives: CooperativeSummary[] }) {
  const router = useRouter();
  const selectCooperative = useSelectCooperativeMutation();
  const [error, setError] = useState<string | null>(null);

  async function handleSelect(cooperativeId: string) {
    setError(null);
    try {
      await selectCooperative.mutateAsync({ ticket, cooperativeId });
      router.push('/dashboard');
    } catch {
      setError('This selection link has expired. Please sign in again.');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Choose a cooperative</CardTitle>
        <CardDescription>You belong to more than one — pick which one to enter.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {cooperatives.map((cooperative) => (
          <Button
            key={cooperative.id}
            type="button"
            variant="outline"
            className="justify-start"
            disabled={selectCooperative.isPending}
            onClick={() => handleSelect(cooperative.id)}
          >
            {cooperative.name}
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}

const createFirstCooperativeFormSchema = z.object({
  name: cooperativeNameSchema,
});
type CreateFirstCooperativeFormValues = z.infer<typeof createFirstCooperativeFormSchema>;

function CreateFirstCooperativeCard({ ticket }: { ticket: string }) {
  const router = useRouter();
  const createFirstCooperative = useCreateFirstCooperativeMutation();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<CreateFirstCooperativeFormValues>({
    resolver: zodResolver(createFirstCooperativeFormSchema),
    defaultValues: { name: '' },
  });

  async function onSubmit(values: CreateFirstCooperativeFormValues) {
    setFormError(null);
    try {
      await createFirstCooperative.mutateAsync({ ticket, ...values });
      router.push('/dashboard');
    } catch (error) {
      const message = applyServerError(form, error);
      if (message) {
        setFormError(message);
      }
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your cooperative</CardTitle>
        <CardDescription>Your account isn&rsquo;t part of a cooperative yet. Set one up now.</CardDescription>
      </CardHeader>
      <CardContent>
        {formError ? (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        ) : null}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cooperative name</FormLabel>
                  <FormControl>
                    <Input placeholder="Umurenge Savings Group" autoComplete="organization" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <CooperativeSlugPreview name={form.watch('name')} />
            <Button type="submit" disabled={form.formState.isSubmitting} className="mt-2">
              {form.formState.isSubmitting ? 'Creating…' : 'Create cooperative'}
            </Button>
          </form>
        </Form>
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
