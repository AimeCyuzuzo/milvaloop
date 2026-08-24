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
  timeZone: 'UTC',
});

export interface DatePickerProps {
  /** Plain 'YYYY-MM-DD', matching the ISO-date convention every form field in this codebase already uses. */
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

function parseIsoDate(value: string | undefined): Date | undefined {
  return value ? new Date(`${value}T00:00:00.000Z`) : undefined;
}

function toIsoDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
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
