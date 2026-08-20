'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { resetPasswordSchema, type ResetPasswordInput } from '@milvaloop/types';

import { Alert, AlertDescription } from '@milvaloop/ui/alert';
import { Button } from '@milvaloop/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@milvaloop/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@milvaloop/ui/form';
import { Input } from '@milvaloop/ui/input';
import { Skeleton } from '@milvaloop/ui/skeleton';

import { applyServerError } from '@/lib/forms/apply-server-error';
import { useResetPasswordMutation } from '@/lib/auth/use-auth-mutations';

function ResetPasswordForm() {
  const token = useSearchParams().get('token');
  const resetPassword = useResetPasswordMutation();
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token: token ?? '', newPassword: '' },
  });

  async function onSubmit(values: ResetPasswordInput) {
    setFormError(null);
    try {
      await resetPassword.mutateAsync(values);
      setDone(true);
    } catch (error) {
      const message = applyServerError(form, error);
      if (message) {
        setFormError(message);
      }
    }
  }

  if (done) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Password changed</CardTitle>
          <CardDescription>
            You&rsquo;re signed out of every device. Log in with your new password to continue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/auth/login" className="text-primary underline-offset-4 hover:underline">
            Go to login
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (!token) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Missing reset link</CardTitle>
          <CardDescription>
            Open this page from the link in your email, or{' '}
            <Link href="/auth/forgot-password" className="text-primary underline-offset-4 hover:underline">
              request a new one
            </Link>
            .
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Set a new password</CardTitle>
        <CardDescription>This also signs you out of every other device.</CardDescription>
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
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New password</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={form.formState.isSubmitting} className="mt-2">
              {form.formState.isSubmitting ? 'Setting password…' : 'Set new password'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<Skeleton className="h-40 w-full" />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
