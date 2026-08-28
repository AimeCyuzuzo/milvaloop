'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { setSharePriceSchema, type SetSharePriceInput, type SharePrice } from '@milvaloop/types';

import { Alert, AlertDescription } from '@milvaloop/ui/alert';
import { AmountInput } from '@milvaloop/ui/amount-input';
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

import { getErrorMessage } from '@/lib/api/api-fetch';
import { formatPeriodLabel, previousPeriod } from '@/lib/contributions/format-period';
import { useDeleteSharePriceMutation, useSetSharePriceMutation } from '@/lib/contributions/use-contribution-mutations';
import { applyServerError } from '@/lib/forms/apply-server-error';

// Extends the grid's own price-covered range backward — this is what
// replaces the earlier "+ Add an earlier month" button, which only ever
// added an empty column with no way to price it except a separate trip
// to Settings (exactly why it produced a confusing "no share price"
// warning). Every column the grid shows is priced by construction now,
// so there's nothing left to warn about once this succeeds.
export function AddHistoricalPriceDialog({ earliestKnownPrice }: { earliestKnownPrice: SharePrice }) {
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const setSharePrice = useSetSharePriceMutation();
  const deleteSharePrice = useDeleteSharePriceMutation();

  function defaultValues(): SetSharePriceInput {
    // Defaults to whatever the nearest known price already is — in the
    // common case (one price, never changed) that's also today's price;
    // extending backward a second time past an already-backfilled point
    // instead guesses "the same as what's already adjacent to the new
    // range", which is the more sensible guess either way.
    return { amount: earliestKnownPrice.amount, effectiveFrom: previousPeriod(earliestKnownPrice.effectiveFrom) };
  }

  const form = useForm<SetSharePriceInput>({
    resolver: zodResolver(setSharePriceSchema),
    defaultValues: defaultValues(),
  });

  function resetForm() {
    setFormError(null);
    form.reset(defaultValues());
  }

  async function onSubmit(values: SetSharePriceInput) {
    setFormError(null);
    try {
      const created = await setSharePrice.mutateAsync(values);
      toast.success(`Share price of ${values.amount.toLocaleString('en-US')} RWF set from ${formatPeriodLabel(values.effectiveFrom)}.`, {
        action: {
          label: 'Undo',
          // A contribution can already reference this price by the time
          // Undo is clicked (e.g. a cell for that month was filled and
          // saved while the toast was still up) — surfacing that instead
          // of failing silently matters here more than most confirm
          // actions, since nothing else on this page tells the user their
          // undo didn't happen.
          onClick: () => {
            deleteSharePrice.mutate(created.id, {
              onError: (error) => toast.error(getErrorMessage(error)),
            });
          },
        },
      });
      setOpen(false);
      resetForm();
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
        setOpen(next);
        if (!next) {
          resetForm();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">+ Add earlier share price history</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add earlier share price history</DialogTitle>
          <DialogDescription>
            Extends the price history backward from {formatPeriodLabel(earliestKnownPrice.effectiveFrom)} — it won&rsquo;t change
            how any later month was priced.
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
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Share price at the time (RWF)</FormLabel>
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
              name="effectiveFrom"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Effective from</FormLabel>
                  <FormControl>
                    <DatePicker value={field.value} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Saving…' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
