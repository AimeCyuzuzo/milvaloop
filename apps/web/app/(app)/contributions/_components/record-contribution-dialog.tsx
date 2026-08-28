'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import type { AllocationProposalLine } from '@milvaloop/types';

import { Alert, AlertDescription } from '@milvaloop/ui/alert';
import { AmountInput } from '@milvaloop/ui/amount-input';
import { Button } from '@milvaloop/ui/button';
import { DatePicker } from '@milvaloop/ui/date-picker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@milvaloop/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@milvaloop/ui/form';
import { Input } from '@milvaloop/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@milvaloop/ui/select';
import { Typography } from '@milvaloop/ui/typography';

import { getErrorMessage } from '@/lib/api/api-fetch';
import { canAdjustTail, describeAllocationLine, tailToggleLabel, toggleTail } from '@/lib/contributions/allocation-adjustments';
import { formatAmount, formatPeriodLabel } from '@/lib/contributions/format-period';
import { usePreviewAllocationMutation, useRecordContributionMutation } from '@/lib/contributions/use-contribution-mutations';
import { todayIsoDate } from '@/lib/dates';
import { applyServerError } from '@/lib/forms/apply-server-error';
import { useMembersQuery } from '@/lib/members/use-members-query';

const detailsSchema = z.object({
  membershipId: z.uuid(),
  amount: z.number().int().positive(),
  contributedAt: z.iso.date(),
  note: z.string().max(500).optional(),
});
type DetailsValues = z.infer<typeof detailsSchema>;

interface RecordContributionDialogProps {
  triggerLabel: string;
  // Set for the self-service entry point: locks the form to this member
  // and hides the picker entirely, so anyone can log their own payment
  // without needing CONTRIBUTIONS_RECORD (the service enforces the same
  // rule independently — this only saves the trip of picking yourself
  // from a list of one meaningful choice).
  fixedMembershipId?: string;
  // A sensible starting point for the amount field — the cooperative's
  // current share price, for someone who almost always pays exactly one
  // share. Still freely editable for a partial or lump-sum payment.
  defaultAmount?: number;
  detailsDescription?: string;
  // Folding a trailing advance into extra shares this month vs. starting
  // a new one is a distribution preference an officer might deliberately
  // want to control. It's not a decision a member self-reporting their
  // own payment needs to make — they just want to say what they paid.
  showAdvanced?: boolean;
}

function emptyDetails(fixedMembershipId: string | undefined, defaultAmount: number | undefined): DetailsValues {
  return {
    membershipId: fixedMembershipId ?? '',
    amount: defaultAmount ?? 0,
    contributedAt: todayIsoDate(),
    note: '',
  };
}

// Two steps: the essentials (who, how much, when), then the system's
// waterfall proposal for how that money applies. The proposal is always
// valid on its own; the only adjustment offered is the one at the tail
// (see allocation-adjustments.ts) — never a blank period/amount field,
// since that's exactly what let someone construct a combination that
// looked plausible on screen but would never have been accepted (or,
// worse, quietly meant something they didn't intend).
export function RecordContributionDialog({
  triggerLabel,
  fixedMembershipId,
  defaultAmount,
  detailsDescription = 'Who paid, how much, and when.',
  showAdvanced = true,
}: RecordContributionDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'details' | 'preview'>('details');
  const [details, setDetails] = useState<DetailsValues | null>(null);
  const [allocations, setAllocations] = useState<AllocationProposalLine[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: membersData } = useMembersQuery();
  const activeMembers = (membersData?.members ?? []).filter((member) => member.status === 'active');

  const preview = usePreviewAllocationMutation();
  const record = useRecordContributionMutation();

  const form = useForm<DetailsValues>({
    resolver: zodResolver(detailsSchema),
    defaultValues: emptyDetails(fixedMembershipId, defaultAmount),
  });

  function reset() {
    setStep('details');
    setDetails(null);
    setAllocations([]);
    setFormError(null);
    form.reset(emptyDetails(fixedMembershipId, defaultAmount));
  }

  async function onSubmitDetails(values: DetailsValues) {
    setFormError(null);
    try {
      const response = await preview.mutateAsync({ membershipId: values.membershipId, amount: values.amount });
      setAllocations(response.lines);
      setDetails(values);
      setStep('preview');
    } catch (error) {
      const message = applyServerError(form, error);
      if (message) {
        setFormError(message);
      }
    }
  }

  async function handleConfirm() {
    if (!details) {
      return;
    }
    setFormError(null);
    try {
      await record.mutateAsync({
        membershipId: details.membershipId,
        amount: details.amount,
        contributedAt: details.contributedAt,
        note: details.note || undefined,
        allocations: allocations.map((line) => ({ period: line.period, amount: line.amount })),
      });
      toast.success('Contribution recorded — awaiting approval.');
      setOpen(false);
      reset();
    } catch (error) {
      setFormError(getErrorMessage(error));
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          reset();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button>{triggerLabel}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{triggerLabel}</DialogTitle>
          <DialogDescription>
            {step === 'details'
              ? detailsDescription
              : 'This is how the payment will be applied — review it before confirming.'}
          </DialogDescription>
        </DialogHeader>
        {formError ? (
          <Alert variant="destructive">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        ) : null}

        {step === 'details' ? (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmitDetails)} className="flex flex-col gap-4">
              {fixedMembershipId ? null : (
                <FormField
                  control={form.control}
                  name="membershipId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Member</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a member" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {activeMembers.map((member) =>
                            member.status === 'active' ? (
                              <SelectItem key={member.membershipId} value={member.membershipId}>
                                {member.name}
                              </SelectItem>
                            ) : null,
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount (RWF)</FormLabel>
                    <FormControl>
                      <AmountInput
                        name={field.name}
                        value={Number.isNaN(field.value) ? undefined : field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        ref={field.ref}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="contributedAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date paid</FormLabel>
                    <FormControl>
                      <DatePicker value={field.value} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="note"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Note (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Cash, mobile money reference" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? 'Calculating…' : 'Continue'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3">
              {allocations.map((line, index) => (
                <div key={line.period} className="flex items-center justify-between gap-4">
                  <div className="flex flex-col">
                    <Typography variant="small">{formatPeriodLabel(line.period)}</Typography>
                    <Typography variant="small" color="muted">
                      {describeAllocationLine(line, index)}
                    </Typography>
                  </div>
                  <Typography variant="small">{formatAmount(line.amount)}</Typography>
                </div>
              ))}
            </div>

            {showAdvanced && canAdjustTail(allocations) ? (
              <div className="self-start">
                <Button type="button" variant="link" size="sm" onClick={() => setAllocations(toggleTail(allocations))}>
                  {tailToggleLabel(allocations)}
                </Button>
              </div>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setStep('details')}>
                Back
              </Button>
              <Button type="button" onClick={handleConfirm} disabled={record.isPending}>
                {record.isPending ? 'Recording…' : 'Confirm'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
