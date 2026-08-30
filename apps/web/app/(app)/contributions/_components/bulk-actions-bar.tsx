'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { unapproveContributionSchema, type ContributionListItem, type UnapproveContributionInput } from '@milvaloop/types';

import { Button } from '@milvaloop/ui/button';
import { ConfirmDialog } from '@milvaloop/ui/confirm-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@milvaloop/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@milvaloop/ui/form';
import { Input } from '@milvaloop/ui/input';
import { Typography } from '@milvaloop/ui/typography';

import { getErrorMessage } from '@/lib/api/api-fetch';
import { useBulkApproveMutation, useBulkRejectMutation } from '@/lib/contributions/use-contribution-mutations';

// The same one-tap presets as the unapprove dialog — most of the time
// there's nothing to actually type.
const QUICK_REASONS = ['Mistake', 'Duplicate entry', 'Wrong amount'];

// The floating bar DataTable renders once at least one row is selected
// (see packages/ui's data-table.tsx `selectionActions`). Every action here
// still confirms before doing anything, the same as its single-row
// equivalent — a bulk action is a shortcut for repeating a click, not a
// way to skip the step that click would have needed.
export function BulkActionsBar({ selectedRows, clearSelection }: { selectedRows: ContributionListItem[]; clearSelection: () => void }) {
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const bulkApprove = useBulkApproveMutation();
  const ids = selectedRows.map((row) => row.id);

  async function handleApprove() {
    let result: Awaited<ReturnType<typeof bulkApprove.mutateAsync>>;
    try {
      result = await bulkApprove.mutateAsync({ ids });
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
    if (result.failed.length === 0) {
      toast.success(`Approved ${result.approved.length} contribution${result.approved.length === 1 ? '' : 's'}.`);
    } else {
      toast.warning(`Approved ${result.approved.length}, ${result.failed.length} couldn't be approved.`);
    }
    clearSelection();
  }

  return (
    <div className="bg-card flex items-center gap-3 rounded-xl border px-4 py-3 shadow-lg">
      <Typography variant="small">{selectedRows.length} selected</Typography>
      <Button size="sm" onClick={() => setApproveOpen(true)}>
        Approve selected
      </Button>
      <Button size="sm" variant="outline" onClick={() => setRejectOpen(true)}>
        Reject selected
      </Button>
      <Button size="sm" variant="ghost" onClick={clearSelection}>
        Clear
      </Button>
      <ConfirmDialog
        open={approveOpen}
        onOpenChange={setApproveOpen}
        title={`Approve ${selectedRows.length} contribution${selectedRows.length === 1 ? '' : 's'}?`}
        description="Each one will be added to the official ledger."
        confirmLabel="Approve"
        pendingLabel="Approving…"
        onConfirm={handleApprove}
      />
      <BulkRejectDialog ids={ids} open={rejectOpen} onOpenChange={setRejectOpen} onDone={clearSelection} />
    </div>
  );
}

// A separate component (not inlined above) purely so its own form state
// resets cleanly per open/close cycle, the same reason the single-row
// reject/unapprove dialogs are their own components rather than inline
// JSX in the row actions menu.
function BulkRejectDialog({
  ids,
  open,
  onOpenChange,
  onDone,
}: {
  ids: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const bulkReject = useBulkRejectMutation();
  // Shares the exact same {reason} shape unapproveContributionSchema does
  // — reused rather than a near-duplicate schema for the same one field.
  const form = useForm<UnapproveContributionInput>({
    resolver: zodResolver(unapproveContributionSchema),
    defaultValues: { reason: '' },
  });

  async function onSubmit(values: UnapproveContributionInput) {
    try {
      const result = await bulkReject.mutateAsync({ ids, ...values });
      if (result.failed.length === 0) {
        toast.success(`Rejected ${result.rejected.length} contribution${result.rejected.length === 1 ? '' : 's'}.`);
      } else {
        toast.warning(`Rejected ${result.rejected.length}, ${result.failed.length} couldn't be rejected.`);
      }
      onOpenChange(false);
      form.reset();
      onDone();
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
          <DialogTitle>
            Reject {ids.length} contribution{ids.length === 1 ? '' : 's'}?
          </DialogTitle>
          <DialogDescription>Say why — this is kept on the record alongside each entry.</DialogDescription>
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
                {form.formState.isSubmitting ? 'Rejecting…' : 'Reject'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
