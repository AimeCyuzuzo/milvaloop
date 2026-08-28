'use client';

import { useMemo, useState } from 'react';

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
import { Label } from '@milvaloop/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@milvaloop/ui/select';
import { Typography } from '@milvaloop/ui/typography';

import { formatAmount, formatPeriodLabel } from '@/lib/contributions/format-period';
import { monthsBetween } from '@/lib/contributions/historical-grid';

import { MemberChecklist, type ImportMember } from './member-checklist';

// "We have a lump sum, split it evenly across however many months" — a
// From/Through range, the same shape BulkFillDialog's range picker
// already uses, rather than a month count next to a single start month
// (two different ways to ask the same "which months" question). The
// resulting date range is always shown before applying, so nobody has to
// count months themselves to know which one is "first".
export function EvenSplitDialog({
  members,
  periods,
  onApply,
}: {
  members: ImportMember[];
  periods: string[];
  onApply: (membershipIds: string[], totalAmount: number, periods: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [startPeriod, setStartPeriod] = useState(periods[0] ?? '');
  const [endPeriod, setEndPeriod] = useState(periods[periods.length - 1] ?? '');

  const fillPeriods = useMemo(
    () => (startPeriod && endPeriod && startPeriod <= endPeriod ? monthsBetween(startPeriod, endPeriod) : []),
    [startPeriod, endPeriod],
  );
  const canApply = selected.length > 0 && totalAmount > 0 && fillPeriods.length > 0;

  function handleApply() {
    if (fillPeriods.length === 0) {
      return;
    }
    onApply(selected, totalAmount, fillPeriods);
    setOpen(false);
    setSelected([]);
    setTotalAmount(0);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Split a lump sum across several months</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Split a lump sum across several months</DialogTitle>
          <DialogDescription>Divides the total evenly per member — any remainder goes to the oldest month.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <MemberChecklist members={members} selected={selected} onChange={setSelected} />
          <div className="flex flex-col gap-2">
            <Label>Total amount (RWF)</Label>
            <AmountInput value={totalAmount} onChange={setTotalAmount} />
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
          {fillPeriods.length > 0 ? (
            <Typography variant="small" color="muted">
              This fills {formatPeriodLabel(startPeriod)} – {formatPeriodLabel(endPeriod)}
              {totalAmount > 0 ? `, about ${formatAmount(Math.floor(totalAmount / fillPeriods.length))} per month` : ''}.
            </Typography>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" disabled={!canApply} onClick={handleApply}>
            Fill
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
