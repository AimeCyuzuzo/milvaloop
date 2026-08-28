'use client';

import * as React from 'react';

import { Input } from '@milvaloop/ui/input';

// A comma-formatted money field — "70,000" instead of a bare "70000",
// which gets genuinely hard to scan once a form or a grid has several
// side by side. A plain `type="text" inputMode="numeric"` rather than
// `type="number"`, since a native number input can't display grouping
// characters at all; typing still behaves like a normal number field —
// anything that isn't a digit is stripped before it reaches `onChange`.
// A hand-composed primitive in this same style as date-picker.tsx, not a
// shadcn-CLI component, so every other Input prop (placeholder, disabled,
// className) still passes straight through.
export interface AmountInputProps extends Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange' | 'type' | 'inputMode'> {
  value: number | undefined;
  onChange: (amount: number) => void;
}

export function formatAmountInput(amount: number): string {
  return amount.toLocaleString('en-US');
}

export function parseAmountInput(text: string): number {
  const digitsOnly = text.replace(/[^0-9]/g, '');
  return digitsOnly ? parseInt(digitsOnly, 10) : 0;
}

export function AmountInput({ value, onChange, ...props }: AmountInputProps) {
  return (
    <Input
      type="text"
      inputMode="numeric"
      value={value ? formatAmountInput(value) : ''}
      onChange={(event) => onChange(parseAmountInput(event.target.value))}
      {...props}
    />
  );
}
