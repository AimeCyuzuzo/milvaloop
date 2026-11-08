'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { inviteLoginSchema, type ActiveMember, type InviteLoginInput } from '@milvaloop/types';

import { Alert, AlertDescription } from '@milvaloop/ui/alert';
import { Button } from '@milvaloop/ui/button';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@milvaloop/ui/responsive-dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@milvaloop/ui/form';
import { Input } from '@milvaloop/ui/input';

import { applyServerError } from '@/lib/forms/apply-server-error';
import { useInviteLoginMutation } from '@/lib/members/use-members-mutations';

// Attaches a real login to a placeholder member — sends an email with a
// link to set a password; their existing history stays exactly where it
// is (see MembersService.acceptInvite's claimUserId branch).
export function InviteLoginDialog({
  member,
  open,
  onOpenChange,
}: {
  member: ActiveMember;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const inviteLogin = useInviteLoginMutation();

  const form = useForm<InviteLoginInput>({
    resolver: zodResolver(inviteLoginSchema),
    defaultValues: { email: '' },
  });

  async function onSubmit(values: InviteLoginInput) {
    setFormError(null);
    try {
      await inviteLogin.mutateAsync({ membershipId: member.membershipId, ...values });
      toast.success(`Invite sent to ${values.email}.`);
      onOpenChange(false);
      form.reset();
    } catch (error) {
      const message = applyServerError(form, error);
      if (message) {
        setFormError(message);
      }
    }
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setFormError(null);
          form.reset();
        }
      }}
    >
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Send a login invite to {member.name}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            They&rsquo;ll get an email with a link to set a password. Their existing history stays exactly as it is.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        {formError ? (
          <Alert variant="destructive">
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
            <ResponsiveDialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Sending invite…' : 'Send invite'}
              </Button>
            </ResponsiveDialogFooter>
          </form>
        </Form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
