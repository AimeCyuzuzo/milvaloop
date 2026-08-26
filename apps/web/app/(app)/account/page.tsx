'use client';

import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { changePasswordSchema, personNameSchema, type ChangePasswordInput } from '@milvaloop/types';
import { z } from 'zod';

import { Alert, AlertDescription } from '@milvaloop/ui/alert';
import { Button } from '@milvaloop/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@milvaloop/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@milvaloop/ui/form';
import { Input } from '@milvaloop/ui/input';
import { Skeleton } from '@milvaloop/ui/skeleton';
import { Switch } from '@milvaloop/ui/switch';
import { Typography } from '@milvaloop/ui/typography';

import { getErrorMessage } from '@/lib/api/api-fetch';
import { applyServerError } from '@/lib/forms/apply-server-error';
import { useChangePasswordMutation, useUpdateProfileMutation } from '@/lib/auth/use-auth-mutations';
import { useCurrentSessionQuery } from '@/lib/auth/use-current-session';
import { useUpdateReminderPauseMutation } from '@/lib/members/use-members-mutations';
import { useMyMembership } from '@/lib/members/use-my-membership';

const nameFormSchema = z.object({ name: personNameSchema });
type NameFormValues = z.infer<typeof nameFormSchema>;

function NameCard() {
  const { data: session } = useCurrentSessionQuery();
  const updateProfile = useUpdateProfileMutation();

  const form = useForm<NameFormValues>({
    resolver: zodResolver(nameFormSchema),
    defaultValues: { name: '' },
  });

  // Resets whenever the session's name changes (including right after this
  // form's own successful save) — react-hook-form's defaultValues only
  // apply on mount, so a value known after that has to be pushed in
  // explicitly.
  useEffect(() => {
    if (session) {
      form.reset({ name: session.user.name });
    }
  }, [session, form]);

  async function onSubmit(values: NameFormValues) {
    try {
      await updateProfile.mutateAsync(values);
      toast.success('Name updated.');
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your name</CardTitle>
        <CardDescription>Shown to other members in place of your email.</CardDescription>
      </CardHeader>
      <CardContent>
        {!session ? (
          <Skeleton className="h-10 w-full" />
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input autoComplete="name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="w-fit">
                <Button type="submit" disabled={form.formState.isSubmitting || !form.formState.isDirty}>
                  {form.formState.isSubmitting ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </CardContent>
    </Card>
  );
}

export default function AccountPage() {
  const changePassword = useChangePasswordMutation();
  const [formError, setFormError] = useState<string | null>(null);
  const myMembership = useMyMembership();
  const updateReminderPause = useUpdateReminderPauseMutation();

  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '' },
  });

  async function onSubmit(values: ChangePasswordInput) {
    setFormError(null);
    try {
      await changePassword.mutateAsync(values);
      toast.success('Password changed.');
      form.reset();
    } catch (error) {
      const message = applyServerError(form, error);
      if (message) {
        setFormError(message);
      }
    }
  }

  async function handleToggleReminders(enabled: boolean) {
    if (!myMembership) {
      return;
    }
    try {
      await updateReminderPause.mutateAsync({ membershipId: myMembership.membershipId, paused: !enabled });
      toast.success(enabled ? 'Reminders resumed.' : 'Reminders paused.');
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <NameCard />

      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
          <CardDescription>This signs you out of every other device.</CardDescription>
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
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current password</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="current-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
              <div className="w-fit">
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? 'Changing…' : 'Change password'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contribution reminders</CardTitle>
          <CardDescription>Get a nudge by email when a monthly contribution is due soon or overdue.</CardDescription>
        </CardHeader>
        <CardContent>
          {!myMembership ? (
            <Skeleton className="h-6 w-full" />
          ) : (
            <div className="flex items-center justify-between gap-4">
              <Typography variant="small">Email me contribution reminders</Typography>
              <Switch
                checked={myMembership.remindersPausedAt === null}
                onCheckedChange={handleToggleReminders}
                disabled={updateReminderPause.isPending}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
