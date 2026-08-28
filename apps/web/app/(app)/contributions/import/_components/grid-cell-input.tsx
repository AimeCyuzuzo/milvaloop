'use client';

import { cn } from '@milvaloop/ui/lib/utils';
import { AmountInput } from '@milvaloop/ui/amount-input';

// One grid cell — a comma-formatted amount (see AmountInput), easier to
// scan across a row of several months than a bare integer would be.
// Clicking it is also how cell selection works (see the grid page's
// shift-click range logic), reported up via onSelect rather than managed
// here, so a plain click both selects the cell and puts the cursor in it
// to type.
export function GridCellInput({
  value,
  onChange,
  selected,
  onSelect,
}: {
  value: number | undefined;
  onChange: (amount: number) => void;
  selected: boolean;
  onSelect: (event: React.MouseEvent) => void;
}) {
  return <AmountInput value={value} onChange={onChange} onMouseDown={onSelect} className={cn('w-28', selected && 'ring-ring ring-2')} />;
}
