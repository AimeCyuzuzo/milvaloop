'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { updateSharePriceSchema, type SharePrice, type UpdateSharePriceInput } from '@milvaloop/types';

import { Alert, AlertDescription } from '@milvaloop/ui/alert';
import { AmountInput } from '@milvaloop/ui/amount-input';
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

import { formatPeriodLabel } from '@/lib/contributions/format-period';
import { useUpdateSharePriceMutation } from '@/lib/contributions/use-contribution-mutations';
import { applyServerError } from '@/lib/forms/apply-server-error';

// Corrects an existing price point's amount in place, rather than adding a
// new one effective going forward (see SetSharePriceDialog for that case).
// A period's due amount is read live from its pinned price row (see
// packages/db/src/schema/share-prices.ts), so this can change what an
// already-recorded contribution's period shows as due, or satisfied —
// `price.usedByContributions` is what turns the warning below on, since a
// price nothing has used yet can be corrected with no such consequence.
export function EditSharePriceDialog({
  price,
  open,
  onOpenChange,
}: {
  price: SharePrice;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const updateSharePrice = useUpdateSharePriceMutation();

  const form = useForm<UpdateSharePriceInput>({
    resolver: zodResolver(updateSharePriceSchema),
    defaultValues: { amount: price.amount },
  });

  function resetForm() {
    setFormError(null);
    form.reset({ amount: price.amount });
  }

  async function onSubmit(values: UpdateSharePriceInput) {
    setFormError(null);
    try {
      await updateSharePrice.mutateAsync({ priceId: price.id, ...values });
      toast.success('Share price updated.');
      onOpenChange(false);
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
          resetForm();
        }
      }}
    >
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Edit the price effective {formatPeriodLabel(price.effectiveFrom)}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>Corrects this price point itself, rather than adding a new one.</ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        {price.usedByContributions ? (
          <Alert>
            <AlertDescription>
              Contributions have already been recorded against this price. Changing it will change what those
              periods show as due — and any analytics for that time — to match the new amount.
            </AlertDescription>
          </Alert>
        ) : null}
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
                  <FormLabel>Price per share (RWF)</FormLabel>
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
            <ResponsiveDialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Saving…' : 'Save'}
              </Button>
            </ResponsiveDialogFooter>
          </form>
        </Form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
