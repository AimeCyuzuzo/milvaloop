'use client';

import * as React from 'react';
import { CalendarIcon } from 'lucide-react';

import { cn } from '@milvaloop/ui/lib/utils';
import { Button } from '@milvaloop/ui/button';
import { Calendar } from '@milvaloop/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@milvaloop/ui/popover';

const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

export interface DatePickerProps {
  /** Plain 'YYYY-MM-DD', matching the ISO-date convention every form field in this codebase already uses. */
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

// Treated as a pure calendar date with no time-of-day or timezone at all —
// both directions read/write the Date object's own *local* parts, never
// the UTC ones, matching how the underlying Calendar (react-day-picker)
// represents a selected day (local midnight). Mixing in UTC accessors
// used to reintroduce the exact bug this component now avoids: in any
// timezone ahead of UTC (Rwanda's UTC+2 included), local midnight on the
// 1st of a month is still the *previous* day in UTC, so reading it back
// with getUTCDate() silently rolled the selection back a full month once
// the caller normalized it to "the first of its month".
function parseIsoDate(value: string | undefined): Date | undefined {
  if (!value) {
    return undefined;
  }
  const parts = value.split('-').map(Number);
  const [year = 0, month = 1, day = 1] = parts;
  return new Date(year, month - 1, day);
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// The shadcn date-picker composition (Popover + Calendar + a trigger
// button), shared here rather than re-composed per call site — every form
// field that needs a real date should read/write the same plain ISO
// string a native `<input type="date">` would, without exposing any of
// react-day-picker's own Date-object API to the rest of the app.
export function DatePicker({ value, onChange, placeholder = 'Pick a date', disabled }: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const selected = parseIsoDate(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" disabled={disabled} className={cn('w-full justify-start text-left font-normal', !selected && 'text-muted-foreground')}>
          <CalendarIcon />
          {selected ? DATE_FORMATTER.format(selected) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={(date) => {
            if (date) {
              onChange(toIsoDate(date));
              setOpen(false);
            }
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
