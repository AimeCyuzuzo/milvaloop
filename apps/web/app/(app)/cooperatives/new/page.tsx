'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { createCooperativeSchema, type CreateCooperativeInput } from '@milvaloop/types';

import { Alert, AlertDescription } from '@milvaloop/ui/alert';
import { Button } from '@milvaloop/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@milvaloop/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@milvaloop/ui/form';
import { Input } from '@milvaloop/ui/input';

import { CooperativeSlugPreview } from '@/components/cooperatives/slug-preview';
import { applyServerError } from '@/lib/forms/apply-server-error';
import { useCreateCooperativeMutation } from '@/lib/auth/use-auth-mutations';

// Adds a brand-new cooperative to the already-signed-in user's account —
// distinct from signup (no new user, no email/password) and from the
// login-time create-first-cooperative flow (this account already has at
// least one membership).
export default function NewCooperativePage() {
  const createCooperative = useCreateCooperativeMutation();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<CreateCooperativeInput>({
    resolver: zodResolver(createCooperativeSchema),
    defaultValues: { name: '' },
  });

  async function onSubmit(values: CreateCooperativeInput) {
    setFormError(null);
    try {
      await createCooperative.mutateAsync(values);
      // A full reload, not router.push — see CooperativeSwitcher's identical
      // reasoning. This account just gained a brand-new tenant context;
      // nothing already mounted (nav, any cached query) should carry over.
      window.location.href = '/dashboard';
    } catch (error) {
      const message = applyServerError(form, error);
      if (message) {
        setFormError(message);
      }
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Create a cooperative</CardTitle>
          <CardDescription>Set up a new cooperative under your existing account.</CardDescription>
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
    </div>
  );
}
