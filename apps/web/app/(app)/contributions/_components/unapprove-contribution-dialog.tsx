'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { unapproveContributionSchema, type UnapproveContributionInput } from '@milvaloop/types';

import { Button } from '@milvaloop/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@milvaloop/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@milvaloop/ui/form';
import { Input } from '@milvaloop/ui/input';

import { getErrorMessage } from '@/lib/api/api-fetch';
import { useUnapproveContributionMutation } from '@/lib/contributions/use-contribution-mutations';

// The common, no-thought-required reasons this happens — one tap fills
// the field instead of making someone type the same handful of
// explanations every time. Still just fills the input, not a separate
// input mode: it can be edited or replaced before submitting.
const QUICK_REASONS = ['Mistake', 'Duplicate entry', 'Wrong amount'];

export function UnapproveContributionDialog({
  contributionId,
  open,
  onOpenChange,
}: {
  contributionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const unapprove = useUnapproveContributionMutation();

  const form = useForm<UnapproveContributionInput>({
    resolver: zodResolver(unapproveContributionSchema),
    defaultValues: { reason: '' },
  });

  async function onSubmit(values: UnapproveContributionInput) {
    try {
      await unapprove.mutateAsync({ contributionId, ...values });
      toast.success('Contribution unapproved — back to pending.');
      onOpenChange(false);
      form.reset();
    } catch (error) {
      form.setError('reason', { message: getErrorMessage(error) });
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          form.reset();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Unapprove this contribution?</DialogTitle>
          <DialogDescription>
            It goes back to pending, no longer counted toward what&rsquo;s paid — say why, this is kept on the record
            alongside the entry.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason</FormLabel>
                  <div className="flex flex-wrap gap-2">
                    {QUICK_REASONS.map((reason) => (
                      <Button
                        key={reason}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => form.setValue('reason', reason, { shouldValidate: true })}
                      >
                        {reason}
                      </Button>
                    ))}
                  </div>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Unapproving…' : 'Unapprove'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
