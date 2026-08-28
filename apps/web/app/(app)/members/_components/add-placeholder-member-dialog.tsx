'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { addPlaceholderMemberSchema, type AddPlaceholderMemberInput } from '@milvaloop/types';

import { Alert, AlertDescription } from '@milvaloop/ui/alert';
import { Button } from '@milvaloop/ui/button';
import { DatePicker } from '@milvaloop/ui/date-picker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@milvaloop/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@milvaloop/ui/form';
import { Input } from '@milvaloop/ui/input';

import { todayIsoDate } from '@/lib/dates';
import { applyServerError } from '@/lib/forms/apply-server-error';
import { useAddPlaceholderMemberMutation } from '@/lib/members/use-members-mutations';

// A member added by name only, with no login at all — for someone with no
// email or smartphone, or as the fast path while bulk-entering a member
// list by hand before importing their contribution history (see
// /contributions/import). A real login can be attached to them later from
// their row in the members table.
export function AddPlaceholderMemberDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [formError, setFormError] = useState<string | null>(null);
  const addMember = useAddPlaceholderMemberMutation();

  const form = useForm<AddPlaceholderMemberInput>({
    resolver: zodResolver(addPlaceholderMemberSchema),
    defaultValues: { name: '', memberSince: todayIsoDate() },
  });

  async function onSubmit(values: AddPlaceholderMemberInput) {
    setFormError(null);
    try {
      await addMember.mutateAsync(values);
      toast.success(`${values.name} was added.`);
      onOpenChange(false);
      form.reset({ name: '', memberSince: todayIsoDate() });
    } catch (error) {
      const message = applyServerError(form, error);
      if (message) {
        setFormError(message);
      }
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setFormError(null);
          form.reset({ name: '', memberSince: todayIsoDate() });
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a member without email</DialogTitle>
          <DialogDescription>
            They&rsquo;ll appear in the cooperative right away, with no login until you send one.
          </DialogDescription>
        </DialogHeader>
        {formError ? (
          <Alert variant="destructive">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        ) : null}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="memberSince"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Member since</FormLabel>
                  <FormControl>
                    <DatePicker value={field.value} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Adding…' : 'Add member'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
