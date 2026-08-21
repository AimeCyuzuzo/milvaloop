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

export function SelectCooperativeCard({ ticket, cooperatives }: { ticket: string; cooperatives: CooperativeSummary[] }) {
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

export function CreateFirstCooperativeCard({ ticket }: { ticket: string }) {
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
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

// Renders whichever card matches the challenge's status — the one bit of
// branching every caller (login, magic-link consume, invite accept) needs.
export function CooperativeChallengeCard({ challenge }: { challenge: CooperativeChallenge }) {
  if (challenge.status === 'selection_required') {
    return <SelectCooperativeCard ticket={challenge.ticket} cooperatives={challenge.cooperatives} />;
  }
  return <CreateFirstCooperativeCard ticket={challenge.ticket} />;
}
