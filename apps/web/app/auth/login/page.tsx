'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { cooperativeNameSchema, loginSchema, type CooperativeSummary, type LoginInput } from '@milvaloop/types';
import { z } from 'zod';

import { Alert, AlertDescription } from '@milvaloop/ui/alert';
import { Button } from '@milvaloop/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@milvaloop/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@milvaloop/ui/form';
import { Input } from '@milvaloop/ui/input';

import { CooperativeSlugPreview } from '@/components/cooperatives/slug-preview';
import { applyServerError } from '@/lib/forms/apply-server-error';
import {
  useCreateFirstCooperativeMutation,
  useLoginMutation,
  useSelectCooperativeMutation,
} from '@/lib/auth/use-auth-mutations';

// Login resolves to one of three outcomes (see LoginResult) once the
// password checks out: straight in, pick from several, or create a first
// one. All three render in place here — the ticket only exists as mutation
// result state, so round-tripping it through a route would mean putting it
// in a URL (leaks into history) for no benefit.
type Challenge =
  | { status: 'selection_required'; ticket: string; cooperatives: CooperativeSummary[] }
  | { status: 'no_cooperatives'; ticket: string };

export default function LoginPage() {
  const router = useRouter();
  const login = useLoginMutation();
  const [formError, setFormError] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(values: LoginInput) {
    setFormError(null);
    try {
      const result = await login.mutateAsync(values);
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

  if (challenge?.status === 'selection_required') {
    return <SelectCooperativeCard ticket={challenge.ticket} cooperatives={challenge.cooperatives} />;
  }

  if (challenge?.status === 'no_cooperatives') {
    return <CreateFirstCooperativeCard ticket={challenge.ticket} />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Log in</CardTitle>
        <CardDescription>Sign in to MilvaLoop.</CardDescription>
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
            <Button type="submit" disabled={form.formState.isSubmitting} className="mt-2">
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
      setError('This selection link has expired. Please log in again.');
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
