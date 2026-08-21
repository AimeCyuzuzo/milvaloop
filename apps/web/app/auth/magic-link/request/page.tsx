'use client';

import { useState } from 'react';
import Link from 'next/link';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { magicLinkRequestSchema, type MagicLinkRequestInput } from '@milvaloop/types';

import { Alert, AlertDescription } from '@milvaloop/ui/alert';
import { Button } from '@milvaloop/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@milvaloop/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@milvaloop/ui/form';
import { Input } from '@milvaloop/ui/input';

import { applyServerError } from '@/lib/forms/apply-server-error';
import { useRequestMagicLinkMutation } from '@/lib/auth/use-auth-mutations';

export default function MagicLinkRequestPage() {
  const requestMagicLink = useRequestMagicLinkMutation();
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const form = useForm<MagicLinkRequestInput>({
    resolver: zodResolver(magicLinkRequestSchema),
    defaultValues: { email: '' },
  });

  async function onSubmit(values: MagicLinkRequestInput) {
    setFormError(null);
    try {
      await requestMagicLink.mutateAsync(values);
      setSent(true);
    } catch (error) {
      const message = applyServerError(form, error);
      if (message) {
        setFormError(message);
      }
    }
  }

  if (sent) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Check your email</CardTitle>
          <CardDescription>
            If that account exists, a sign-in link is on its way. It expires in 15 minutes.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email me a sign-in link</CardTitle>
        <CardDescription>No password needed — we&rsquo;ll email you a one-time link.</CardDescription>
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
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Sending…' : 'Send sign-in link'}
            </Button>
          </form>
        </Form>
        <p className="text-muted-foreground mt-4 text-center text-sm">
          <Link href="/auth/login" className="text-primary underline-offset-4 hover:underline">
            Log in with a password instead
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
