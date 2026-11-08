'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { signupSchema, type SignupInput, type TenantPlan } from '@milvaloop/types';

import { Alert, AlertDescription } from '@milvaloop/ui/alert';
import { Button } from '@milvaloop/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@milvaloop/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@milvaloop/ui/form';
import { Input } from '@milvaloop/ui/input';

import { CooperativeSlugPreview } from '@/components/cooperatives/slug-preview';
import { applyServerError } from '@/lib/forms/apply-server-error';
import { useSignupMutation } from '@/lib/auth/use-auth-mutations';

export default function SignupPage() {
  const router = useRouter();
  const signup = useSignupMutation();
  const [formError, setFormError] = useState<string | null>(null);
  // Only ever set by the pricing page's Premium card (see
  // apps/web/app/(public)/pricing/page.tsx) — anything else in the query
  // string just means a plain Free signup, same as no param at all.
  const requestedPlan: TenantPlan | undefined =
    useSearchParams().get('plan') === 'premium' ? 'premium' : undefined;

  const form = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { tenantName: '', name: '', email: '', password: '' },
  });

  async function onSubmit(values: SignupInput) {
    setFormError(null);
    try {
      await signup.mutateAsync({ ...values, plan: requestedPlan });
      toast.success('Account created — check your email to verify it.');
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
        <CardDescription>
          {requestedPlan === 'premium'
            ? 'Set up MilvaLoop and start your free 2-month Premium trial.'
            : 'Set up MilvaLoop for your group in a couple of minutes.'}
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
              name="tenantName"
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
            <CooperativeSlugPreview name={form.watch('tenantName')} />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Your name</FormLabel>
                  <FormControl>
                    <Input autoComplete="name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Creating account…' : 'Create account'}
            </Button>
          </form>
        </Form>
        <p className="text-muted-foreground mt-4 text-center text-sm">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-primary underline-offset-4 hover:underline">
            Log in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
