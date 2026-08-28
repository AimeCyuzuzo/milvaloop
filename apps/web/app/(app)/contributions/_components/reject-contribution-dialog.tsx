'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { rejectContributionSchema, type RejectContributionInput } from '@milvaloop/types';

import { Button } from '@milvaloop/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@milvaloop/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@milvaloop/ui/form';
import { Input } from '@milvaloop/ui/input';

import { getErrorMessage } from '@/lib/api/api-fetch';
import { useRejectContributionMutation } from '@/lib/contributions/use-contribution-mutations';

export function RejectContributionDialog({
  contributionId,
  open,
  onOpenChange,
}: {
  contributionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const reject = useRejectContributionMutation();

  const form = useForm<RejectContributionInput>({
    resolver: zodResolver(rejectContributionSchema),
    defaultValues: { reason: '' },
  });

  async function onSubmit(values: RejectContributionInput) {
    try {
      await reject.mutateAsync({ contributionId, ...values });
      toast.success('Contribution rejected.');
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
          <DialogTitle>Reject this contribution?</DialogTitle>
          <DialogDescription>Say why — this is kept on the record alongside the entry.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason</FormLabel>
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
                {form.formState.isSubmitting ? 'Rejecting…' : 'Reject'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
