'use client';

import { useState } from 'react';

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
import { Label } from '@milvaloop/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@milvaloop/ui/select';

import { formatPeriodLabel } from '@/lib/contributions/format-period';
import { monthsBetween } from '@/lib/contributions/historical-grid';

import { MemberChecklist, type ImportMember } from './member-checklist';

// "Select a member, an amount, and fill it into every one of these
// months" — the straightforward case where the same amount applies to
// every covered month (the common case for a fixed monthly share price).
export function BulkFillDialog({
  members,
  periods,
  onApply,
}: {
  members: ImportMember[];
  periods: string[];
  onApply: (membershipIds: string[], amount: number, periods: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [amount, setAmount] = useState(0);
  const [startPeriod, setStartPeriod] = useState(periods[0] ?? '');
  const [endPeriod, setEndPeriod] = useState(periods[periods.length - 1] ?? '');

  const canApply = selected.length > 0 && amount > 0 && startPeriod <= endPeriod;

  function handleApply() {
    onApply(selected, amount, monthsBetween(startPeriod, endPeriod));
    setOpen(false);
    setSelected([]);
    setAmount(0);
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={setOpen}>
      <ResponsiveDialogTrigger asChild>
        <Button variant="outline">Fill the same amount for several months</Button>
      </ResponsiveDialogTrigger>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Fill the same amount for several months</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Applies to every month in range for each member selected — edit any single cell afterward.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <div className="flex flex-col gap-4">
          <MemberChecklist members={members} selected={selected} onChange={setSelected} />
          <div className="flex flex-col gap-2">
            <Label>Amount per month (RWF)</Label>
            <AmountInput value={amount} onChange={setAmount} />
          </div>
          <div className="flex gap-2">
            <div className="flex flex-1 flex-col gap-2">
              <Label>From</Label>
              <Select value={startPeriod} onValueChange={setStartPeriod}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {periods.map((period) => (
                    <SelectItem key={period} value={period}>
                      {formatPeriodLabel(period)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <Label>Through</Label>
              <Select value={endPeriod} onValueChange={setEndPeriod}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {periods.map((period) => (
                    <SelectItem key={period} value={period}>
                      {formatPeriodLabel(period)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <ResponsiveDialogFooter>
          <Button type="button" disabled={!canApply} onClick={handleApply}>
            Fill
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
