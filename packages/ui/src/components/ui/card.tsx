import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@milvaloop/ui/lib/utils';

// No border, no shadow — the background/card contrast (see globals.css) is
// what reads this as a surface, not a line around it. See sample.tsx's v8
// notes for the full reasoning: a bordered card on a barely-different
// background is fighting color contrast that isn't doing its job; a real
// contrast step needs no border at all. `highlighted` is the one deliberate
// exception — a real accent, not a structural boundary, so it gets its own
// explicit border rather than inheriting one.
//
// The tinted variants (`primary`/`success`/`warning`/`violet`/`sky`) are a
// wash of an existing semantic token, never a new color — they stay
// correct in both themes for free, since the token itself is already
// redefined per theme (see globals.css), and there's no fourth palette to
// keep in sync if this app's accent colors ever change. `primary` (Navy)
// is the one tint to reach for carefully: it's markedly lower-chroma than
// the other four (see globals.css's comment on --primary), so its
// 25%-wash reads as gray rather than a clear color — prefer one of the
// others for a card that has no real status/brand tie to primary
// specifically.
const cardVariants = cva('text-card-foreground flex flex-col gap-6 rounded-xl py-6', {
  variants: {
    variant: {
      default: 'bg-card',
      highlighted: 'bg-card border border-primary',
      primary: 'bg-primary/25',
      success: 'bg-success/25',
      warning: 'bg-warning/25',
      violet: 'bg-violet/25',
      sky: 'bg-sky/25',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

function Card({
  className,
  variant,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof cardVariants>) {
  return (
    <div data-slot="card" className={cn(cardVariants({ variant }), className)} {...props} />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        '@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6',
        className,
      )}
      {...props}
    />
  );
}

// `lg` exists for a card whose whole point is one headline number (a
// dashboard stat, a count) — the default size reads fine as a section
// label but disappears next to content meant to be the card's main point.
const cardTitleVariants = cva('leading-none font-semibold', {
  variants: {
    size: {
      default: '',
      lg: 'text-2xl',
    },
  },
  defaultVariants: {
    size: 'default',
  },
});

function CardTitle({
  className,
  size,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof cardTitleVariants>) {
  return <div data-slot="card-title" className={cn(cardTitleVariants({ size }), className)} {...props} />;
}

function CardDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div data-slot="card-description" className={cn('text-muted-foreground text-sm', className)} {...props} />
  );
}

function CardAction({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-action"
      className={cn('col-start-2 row-span-2 row-start-1 self-start justify-self-end', className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-content" className={cn('px-6', className)} {...props} />;
}

function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-footer"
      className={cn('flex items-center px-6 [.border-t]:pt-6', className)}
      {...props}
    />
  );
}

export { Card, CardHeader, CardFooter, CardTitle, CardAction, CardDescription, CardContent };
