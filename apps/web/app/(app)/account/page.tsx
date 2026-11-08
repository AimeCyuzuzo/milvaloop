'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTheme } from 'next-themes';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Building2, Check, LogOut, Plus } from 'lucide-react';
import { changePasswordSchema, personNameSchema, type ChangePasswordInput } from '@milvaloop/types';
import { z } from 'zod';

import { Alert, AlertDescription } from '@milvaloop/ui/alert';
import { Button } from '@milvaloop/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@milvaloop/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@milvaloop/ui/form';
import { Input } from '@milvaloop/ui/input';
import { Skeleton } from '@milvaloop/ui/skeleton';
import { Switch } from '@milvaloop/ui/switch';
import { THEME_OPTIONS } from '@milvaloop/ui/theme-toggle';
import { Typography } from '@milvaloop/ui/typography';

import { getErrorMessage } from '@/lib/api/api-fetch';
import { applyServerError } from '@/lib/forms/apply-server-error';
import {
  useChangePasswordMutation,
  useLogoutMutation,
  useSwitchCooperativeMutation,
  useUpdateProfileMutation,
} from '@/lib/auth/use-auth-mutations';
import { useCurrentSessionQuery } from '@/lib/auth/use-current-session';
import { useUpdateDigestPauseMutation, useUpdateReminderPauseMutation } from '@/lib/members/use-members-mutations';
import { useMyMembership } from '@/lib/members/use-my-membership';

// The sidebar's own header/footer (CooperativeSwitcher, AccountMenu) are
// unreachable on mobile once the sidebar itself is never opened there (see
// bottom-tab-bar.tsx) — this page is where that same switching/sign-out
// capability lives instead, as a plain full-page section rather than a
// dropdown, since a full page reads better than a cramped menu on a phone.
// It reuses the exact same mutations those sidebar components call, just
// with markup suited to a page instead of a compact trigger.
function CooperativeCard() {
  const { data: session } = useCurrentSessionQuery();
  const switchCooperative = useSwitchCooperativeMutation();

  async function handleSelect(cooperativeId: string) {
    if (!session || cooperativeId === session.tenant.id) {
      return;
    }
    try {
      await switchCooperative.mutateAsync({ cooperativeId });
      // Same full reload CooperativeSwitcher uses — every query's cached
      // data belongs to the cooperative just left, and a client-side cache
      // clear doesn't reliably force an already-mounted page to refetch.
      window.location.href = '/dashboard';
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cooperative</CardTitle>
        <CardDescription>Switch between cooperatives you belong to, or start a new one.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {!session ? (
          <Skeleton className="h-10 w-full" />
        ) : (
          <>
            {session.cooperatives.map((cooperative) => (
              <Button
                key={cooperative.id}
                variant={cooperative.id === session.tenant.id ? 'secondary' : 'outline'}
                className="justify-between"
                disabled={switchCooperative.isPending}
                onClick={() => handleSelect(cooperative.id)}
              >
                <span className="truncate">{cooperative.name}</span>
                {cooperative.id === session.tenant.id ? <Check className="shrink-0" /> : null}
              </Button>
            ))}
            <Button asChild variant="ghost" className="justify-start">
              <Link href="/cooperatives/new">
                <Plus />
                Create a cooperative
              </Link>
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// A tenant's plan, and anything else cooperative-wide rather than personal
// to this member, lives on its own page (see group-settings/page.tsx) — not
// here, where every other card is scoped to the person looking at it. The
// sidebar already links there directly (see nav-items.ts); this card exists
// only because the bottom tab bar has no slot for it (see
// bottom-tab-bar.tsx), so a mobile visitor needs a way in from somewhere
// that is reachable.
function GroupSettingsCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Group Settings</CardTitle>
        <CardDescription>Plan and other cooperative-wide settings.</CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild variant="outline">
          <Link href="/group-settings">
            <Building2 />
            Go to Group Settings
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function PreferencesCard() {
  const { theme, setTheme } = useTheme();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Preferences</CardTitle>
        <CardDescription>How MilvaLoop looks on this device.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
          <Button key={value} variant={theme === value ? 'secondary' : 'outline'} size="sm" onClick={() => setTheme(value)}>
            <Icon />
            {label}
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}

function SignOutCard() {
  const router = useRouter();
  const logout = useLogoutMutation();

  async function handleLogout() {
    await logout.mutateAsync();
    router.push('/auth/login');
  }

  return (
    <Card>
      <CardContent>
        <Button variant="destructive" className="w-full" onClick={() => void handleLogout()} disabled={logout.isPending}>
          <LogOut />
          {logout.isPending ? 'Signing out…' : 'Sign out'}
        </Button>
      </CardContent>
    </Card>
  );
}

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
  const updateDigestPause = useUpdateDigestPauseMutation();

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

  async function handleToggleDigest(enabled: boolean) {
    if (!myMembership) {
      return;
    }
    try {
      await updateDigestPause.mutateAsync({ membershipId: myMembership.membershipId, paused: !enabled });
      toast.success(enabled ? 'Monthly digest resumed.' : 'Monthly digest paused.');
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
          <CardTitle>Email preferences</CardTitle>
          <CardDescription>Choose which emails MilvaLoop sends you.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!myMembership ? (
            <Skeleton className="h-6 w-full" />
          ) : (
            <>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Typography variant="small">Contribution reminders</Typography>
                  <Typography variant="small" color="muted">
                    A nudge when a monthly contribution is due soon or overdue.
                  </Typography>
                </div>
                <Switch
                  checked={myMembership.remindersPausedAt === null}
                  onCheckedChange={handleToggleReminders}
                  disabled={updateReminderPause.isPending}
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Typography variant="small">Monthly digest</Typography>
                  <Typography variant="small" color="muted">
                    A summary of the cooperative&rsquo;s numbers each month.
                  </Typography>
                </div>
                <Switch
                  checked={myMembership.digestPausedAt === null}
                  onCheckedChange={handleToggleDigest}
                  disabled={updateDigestPause.isPending}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <PreferencesCard />
      <GroupSettingsCard />
      <CooperativeCard />
      <SignOutCard />
    </div>
  );
}
