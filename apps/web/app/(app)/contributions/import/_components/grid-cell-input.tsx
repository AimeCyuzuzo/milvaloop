'use client';

import { cn } from '@milvaloop/ui/lib/utils';
import { AmountInput } from '@milvaloop/ui/amount-input';
import { Typography } from '@milvaloop/ui/typography';

import { formatAmount } from '@/lib/contributions/format-period';

// One grid cell — a comma-formatted amount (see AmountInput), easier to
// scan across a row of several months than a bare integer would be.
// Clicking it is also how cell selection works (see the grid page's
// shift-click range logic), reported up via onSelect rather than managed
// here, so a plain click both selects the cell and puts the cursor in it
// to type. `baseline` is what's already recorded for this cell (see
// historical-grid.ts's buildBaselineGrid) — the field is floor-clamped to
// it (never lets an edit read as reducing something already on record)
// and a cell exactly at its baseline is captioned as already recorded, so
// a period that's fully covered reads as covered rather than blank.
export function GridCellInput({
  value,
  onChange,
  baseline,
  selected,
  onSelect,
}: {
  value: number | undefined;
  onChange: (amount: number) => void;
  baseline: number;
  selected: boolean;
  onSelect: (event: React.MouseEvent) => void;
}) {
  const isUntouched = baseline > 0 && (value ?? 0) <= baseline;
  return (
    <div className="flex flex-col gap-1">
      <AmountInput
        value={value}
        onChange={onChange}
        min={baseline}
        onMouseDown={onSelect}
        className={cn('w-28', selected && 'ring-ring ring-2')}
      />
      {baseline > 0 ? (
        <Typography variant="muted" className="text-xs whitespace-nowrap">
          {isUntouched ? `Recorded: ${formatAmount(baseline)}` : `+${formatAmount((value ?? 0) - baseline)} new`}
        </Typography>
      ) : null}
    </div>
  );
}
