'use client';

import { useState } from 'react';
import Link from 'next/link';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { forgotPasswordSchema, type ForgotPasswordInput } from '@milvaloop/types';

import { Alert, AlertDescription } from '@milvaloop/ui/alert';
import { Button } from '@milvaloop/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@milvaloop/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@milvaloop/ui/form';
import { Input } from '@milvaloop/ui/input';

import { applyServerError } from '@/lib/forms/apply-server-error';
import { useForgotPasswordMutation } from '@/lib/auth/use-auth-mutations';

export default function ForgotPasswordPage() {
  const forgotPassword = useForgotPasswordMutation();
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  async function onSubmit(values: ForgotPasswordInput) {
    setFormError(null);
    try {
      await forgotPassword.mutateAsync(values);
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
            If that account exists, a password reset link is on its way. It expires in 1 hour.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reset your password</CardTitle>
        <CardDescription>We&rsquo;ll email you a link to set a new password.</CardDescription>
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
            <Button type="submit" disabled={form.formState.isSubmitting} className="mt-2">
              {form.formState.isSubmitting ? 'Sending…' : 'Send reset link'}
            </Button>
          </form>
        </Form>
        <p className="text-muted-foreground mt-4 text-center text-sm">
          <Link href="/auth/login" className="text-primary underline-offset-4 hover:underline">
            Back to login
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
