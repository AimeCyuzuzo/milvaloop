'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { cooperativeNameSchema, type CooperativeSummary } from '@milvaloop/types';
import { z } from 'zod';

import { Alert, AlertDescription } from '@milvaloop/ui/alert';
import { Button } from '@milvaloop/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@milvaloop/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@milvaloop/ui/form';
import { Input } from '@milvaloop/ui/input';

import { CooperativeSlugPreview } from '@/components/cooperatives/slug-preview';
import { applyServerError } from '@/lib/forms/apply-server-error';
import { useCreateFirstCooperativeMutation, useSelectCooperativeMutation } from '@/lib/auth/use-auth-mutations';

// The shared "pick one of several, or create your first" step that follows
// any flow that can end in LoginResult's non-'authenticated' branches —
// login, magic-link consume, and invite accept all resolve identity without
// yet knowing which cooperative to enter, so all three render this in place
// rather than each keeping its own copy (see LoginResult in @milvaloop/types).
export type CooperativeChallenge =
  | { status: 'selection_required'; ticket: string; cooperatives: CooperativeSummary[] }
  | { status: 'no_cooperatives'; ticket: string };

export function SelectCooperativeCard({
  ticket,
  cooperatives,
  redirectTo = '/dashboard',
}: {
  ticket: string;
  cooperatives: CooperativeSummary[];
  redirectTo?: string;
}) {
  const router = useRouter();
  const selectCooperative = useSelectCooperativeMutation();
  const [error, setError] = useState<string | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);

  async function handleSelect(cooperativeId: string) {
    setError(null);
    try {
      await selectCooperative.mutateAsync({ ticket, cooperativeId });
      router.push(redirectTo);
    } catch {
      setError('This selection link has expired. Please log in again.');
    }
  }

  // The ticket only proves identity, not which cooperative — the same
  // login-ticket-based create endpoint used for the zero-cooperatives case
  // works here too (it doesn't care how many the account already has), so
  // "none of these" gets the same form rather than a separate flow.
  if (creatingNew) {
    return (
      <CreateFirstCooperativeCard
        ticket={ticket}
        redirectTo={redirectTo}
        title="Create a new cooperative"
        description="Set up another cooperative under this account."
        onCancel={() => setCreatingNew(false)}
      />
    );
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
        <Button type="button" variant="ghost" className="justify-start" onClick={() => setCreatingNew(true)}>
          Create a new cooperative instead
        </Button>
      </CardContent>
    </Card>
  );
}

const createFirstCooperativeFormSchema = z.object({
  name: cooperativeNameSchema,
});
type CreateFirstCooperativeFormValues = z.infer<typeof createFirstCooperativeFormSchema>;

export function CreateFirstCooperativeCard({
  ticket,
  redirectTo = '/dashboard',
  title = 'Create your cooperative',
  description = "Your account isn't part of a cooperative yet. Set one up now.",
  onCancel,
}: {
  ticket: string;
  redirectTo?: string;
  title?: string;
  description?: string;
  /** Renders a "Back" action when reached from SelectCooperativeCard's toggle rather than fresh from a zero-cooperatives login. */
  onCancel?: () => void;
}) {
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
      router.push(redirectTo);
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
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
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
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Creating…' : 'Create cooperative'}
            </Button>
            {onCancel ? (
              <Button type="button" variant="ghost" onClick={onCancel}>
                Back
              </Button>
            ) : null}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

// Renders whichever card matches the challenge's status — the one bit of
// branching every caller (login, magic-link consume, invite accept) needs.
// redirectTo defaults to /dashboard but a caller reached via a `?redirect=`
// round-trip (see redirect-target.ts) passes its real destination through.
export function CooperativeChallengeCard({
  challenge,
  redirectTo,
}: {
  challenge: CooperativeChallenge;
  redirectTo?: string;
}) {
  if (challenge.status === 'selection_required') {
    return (
      <SelectCooperativeCard ticket={challenge.ticket} cooperatives={challenge.cooperatives} redirectTo={redirectTo} />
    );
  }
  return <CreateFirstCooperativeCard ticket={challenge.ticket} redirectTo={redirectTo} />;
}
