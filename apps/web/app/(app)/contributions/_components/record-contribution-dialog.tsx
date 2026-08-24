'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import type { AllocationLine } from '@milvaloop/types';

import { Alert, AlertDescription } from '@milvaloop/ui/alert';
import { Button } from '@milvaloop/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@milvaloop/ui/dialog';
import { DatePicker } from '@milvaloop/ui/date-picker';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@milvaloop/ui/form';
import { Input } from '@milvaloop/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@milvaloop/ui/select';
import { Typography } from '@milvaloop/ui/typography';

import { getErrorMessage } from '@/lib/api/api-fetch';
import { currentPeriod, formatAmount, formatPeriodLabel, toPeriodStart } from '@/lib/contributions/format-period';
import { usePreviewAllocationMutation, useRecordContributionMutation } from '@/lib/contributions/use-contribution-mutations';
import { applyServerError } from '@/lib/forms/apply-server-error';
import { useMembersQuery } from '@/lib/members/use-members-query';

const detailsSchema = z.object({
  membershipId: z.uuid(),
  amount: z.number().int().positive(),
  contributedAt: z.iso.date(),
  note: z.string().max(500).optional(),
});
type DetailsValues = z.infer<typeof detailsSchema>;

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function emptyDetails(): DetailsValues {
  return { membershipId: '', amount: 0, contributedAt: todayIsoDate(), note: '' };
}

// Two steps: the essentials (who, how much, when), then the system's
// waterfall proposal for how that money applies — shown before anything is
// written, editable via "Adjust allocation" rather than ever applied
// silently (see the feature plan's explicit-allocation rule).
export function RecordContributionDialog() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'details' | 'preview'>('details');
  const [details, setDetails] = useState<DetailsValues | null>(null);
  const [allocations, setAllocations] = useState<AllocationLine[]>([]);
  const [adjusting, setAdjusting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: membersData } = useMembersQuery();
  const activeMembers = (membersData?.members ?? []).filter((member) => member.status === 'active');

  const preview = usePreviewAllocationMutation();
  const record = useRecordContributionMutation();

  const form = useForm<DetailsValues>({
    resolver: zodResolver(detailsSchema),
    defaultValues: emptyDetails(),
  });

  function reset() {
    setStep('details');
    setDetails(null);
    setAllocations([]);
    setAdjusting(false);
    setFormError(null);
    form.reset(emptyDetails());
  }

  async function onSubmitDetails(values: DetailsValues) {
    setFormError(null);
    try {
      const response = await preview.mutateAsync({ membershipId: values.membershipId, amount: values.amount });
      setAllocations(response.lines.map((line) => ({ period: line.period, amount: line.amount })));
      setDetails(values);
      setAdjusting(false);
      setStep('preview');
    } catch (error) {
      const message = applyServerError(form, error);
      if (message) {
        setFormError(message);
      }
    }
  }

  const allocatedTotal = allocations.reduce((total, line) => total + line.amount, 0);
  const remaining = (details?.amount ?? 0) - allocatedTotal;

  function updateAllocationAmount(index: number, amount: number) {
    setAllocations((current) => current.map((line, i) => (i === index ? { ...line, amount } : line)));
  }

  function updateAllocationPeriod(index: number, period: string) {
    setAllocations((current) => current.map((line, i) => (i === index ? { ...line, period } : line)));
  }

  function removeAllocation(index: number) {
    setAllocations((current) => current.filter((_, i) => i !== index));
  }

  function addAllocation() {
    setAllocations((current) => [...current, { period: currentPeriod(), amount: 0 }]);
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
        allocations,
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
        <Button>Record a contribution</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record a contribution</DialogTitle>
          <DialogDescription>
            {step === 'details'
              ? 'Who paid, how much, and when.'
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
                              {member.email}
                            </SelectItem>
                          ) : null,
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount (RWF)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        step={1}
                        name={field.name}
                        value={Number.isNaN(field.value) ? '' : field.value}
                        onChange={(event) => field.onChange(event.target.valueAsNumber)}
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
            <div className="flex flex-col gap-2">
              {allocations.map((line, index) => (
                <div key={index} className="flex items-center gap-2">
                  {adjusting ? (
                    <>
                      <div className="flex-1">
                        <DatePicker
                          value={line.period}
                          onChange={(value) => updateAllocationPeriod(index, toPeriodStart(value))}
                        />
                      </div>
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        value={line.amount}
                        onChange={(event) => updateAllocationAmount(index, event.target.valueAsNumber || 0)}
                      />
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeAllocation(index)}>
                        Remove
                      </Button>
                    </>
                  ) : (
                    <div className="flex w-full items-center justify-between gap-2">
                      <Typography variant="small">{formatPeriodLabel(line.period)}</Typography>
                      <Typography variant="small">{formatAmount(line.amount)}</Typography>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {adjusting ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button type="button" variant="outline" size="sm" onClick={addAllocation}>
                  Add a month
                </Button>
                <Typography variant="small" color={remaining === 0 ? 'muted' : 'accent'}>
                  {remaining === 0
                    ? 'Fully allocated'
                    : `${formatAmount(Math.abs(remaining))} ${remaining > 0 ? 'unallocated' : 'over-allocated'}`}
                </Typography>
              </div>
            ) : (
              <Button type="button" variant="outline" size="sm" onClick={() => setAdjusting(true)}>
                Adjust allocation
              </Button>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setStep('details')}>
                Back
              </Button>
              <Button type="button" onClick={handleConfirm} disabled={remaining !== 0 || record.isPending}>
                {record.isPending ? 'Recording…' : 'Confirm'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
