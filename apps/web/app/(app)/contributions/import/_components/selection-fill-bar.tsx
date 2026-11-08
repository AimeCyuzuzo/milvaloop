'use client';

import { useState } from 'react';

import { AmountInput } from '@milvaloop/ui/amount-input';
import { Button } from '@milvaloop/ui/button';
import { Typography } from '@milvaloop/ui/typography';

// Shown only while one or more cells are selected (see the grid page's
// click/shift-click selection state) — a fast, inline alternative to
// opening a fill dialog and re-picking members from a checklist for an
// ad-hoc correction across whichever cells are already selected. Enter in
// the amount field fills, matching a spreadsheet's own commit-on-Enter feel.
export function SelectionFillBar({
  count,
  onFill,
  onClear,
}: {
  count: number;
  onFill: (amount: number) => void;
  onClear: () => void;
}) {
  const [amount, setAmount] = useState(0);
  const canFill = amount > 0;

  function handleFill() {
    if (!canFill) {
      return;
    }
    onFill(amount);
    setAmount(0);
  }

  return (
    <div className="bg-muted flex flex-wrap items-center gap-2 rounded-md border p-3">
      <Typography variant="small">
        {count} cell{count === 1 ? '' : 's'} selected
      </Typography>
      <AmountInput
        placeholder="Amount"
        value={amount}
        onChange={setAmount}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            handleFill();
          }
        }}
        className="w-28"
      />
      <Button type="button" size="sm" disabled={!canFill} onClick={handleFill}>
        Fill
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={onClear}>
        Clear selection
      </Button>
    </div>
  );
}
