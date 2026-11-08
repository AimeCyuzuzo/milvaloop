'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { setSharePriceSchema, type SetSharePriceInput } from '@milvaloop/types';

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
  ResponsiveDialogTrigger,
} from '@milvaloop/ui/responsive-dialog';
import { DatePicker } from '@milvaloop/ui/date-picker';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@milvaloop/ui/form';

import { currentPeriod } from '@/lib/contributions/format-period';
import { applyServerError } from '@/lib/forms/apply-server-error';
import { useSetSharePriceMutation } from '@/lib/contributions/use-contribution-mutations';

function defaultValues(): SetSharePriceInput {
  return { amount: 0, effectiveFrom: currentPeriod() };
}

export function SetSharePriceDialog({ triggerLabel }: { triggerLabel: string }) {
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const setSharePrice = useSetSharePriceMutation();

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
      await setSharePrice.mutateAsync(values);
      toast.success('Share price set.');
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
    <ResponsiveDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          resetForm();
        }
      }}
    >
      <ResponsiveDialogTrigger asChild>
        <Button>{triggerLabel}</Button>
      </ResponsiveDialogTrigger>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Set the share price</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            This won&rsquo;t change how past months were priced — it only applies going forward.
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
