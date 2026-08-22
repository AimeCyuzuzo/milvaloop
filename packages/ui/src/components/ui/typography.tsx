import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@milvaloop/ui/lib/utils';

const typographyVariants = cva('', {
  variants: {
    variant: {
      h1: 'scroll-m-20 text-4xl font-semibold tracking-tight text-balance',
      h2: 'scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0',
      h3: 'scroll-m-20 text-2xl font-semibold tracking-tight',
      h4: 'scroll-m-20 text-xl font-semibold tracking-tight',
      p: 'leading-7 [&:not(:first-child)]:mt-6',
      lead: 'text-xl text-muted-foreground',
      large: 'text-lg font-semibold',
      small: 'text-sm leading-none font-medium',
      muted: 'text-sm text-muted-foreground',
      blockquote: 'mt-6 border-l-2 pl-6 italic',
      list: 'my-6 ml-6 list-disc [&>li]:mt-2',
      inlineCode:
        'bg-muted relative rounded px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold',
    },
    // Optional foreground-color override, independent of variant — e.g. a
    // `small` variant that also needs to read as muted. No default: most
    // variants already set their own color (lead's built-in muted, for
    // instance), so forcing one here for every instance would fight them.
    // text-balance controls line-wrapping, not color, so it lives on the
    // individual variants that want it (h1, above) rather than in this
    // group.
    color: {
      primary: 'text-primary',
      secondary: 'text-secondary',
      accent: 'text-accent',
      muted: 'text-muted-foreground',
    },
  },
  defaultVariants: {
    variant: 'p',
  },
});

const DEFAULT_ELEMENT = {
  h1: 'h1',
  h2: 'h2',
  h3: 'h3',
  h4: 'h4',
  p: 'p',
  lead: 'p',
  large: 'div',
  small: 'small',
  muted: 'p',
  blockquote: 'blockquote',
  list: 'ul',
  inlineCode: 'code',
} as const;

type TypographyVariant = keyof typeof DEFAULT_ELEMENT;

function Typography({
  className,
  variant = 'p',
  color,
  asChild = false,
  as,
  ...props
}: React.ComponentProps<'p'> &
  VariantProps<typeof typographyVariants> & {
    asChild?: boolean;
    /** Override the rendered element without changing the visual style. */
    as?: React.ElementType;
  }) {
  const resolvedVariant = (variant ?? 'p') as TypographyVariant;
  const Comp = asChild ? Slot : (as ?? DEFAULT_ELEMENT[resolvedVariant]);

  return (
    <Comp
      data-slot="typography"
      data-variant={resolvedVariant}
      className={cn(typographyVariants({ variant: resolvedVariant, color }), className)}
      {...props}
    />
  );
}

export { Typography, typographyVariants };
