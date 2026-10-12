'use client';

import type { TenantAccessState } from '@milvaloop/types';

import { cn } from '@milvaloop/ui/lib/utils';

// Severity maps onto the same success/warning/destructive tokens used
// everywhere else in the product (see packages/ui/src/components/ui/badge.tsx)
// — gray-to-red is three real design states escalating, not an invented
// gradient. 'locked' gets the same destructive color as 'high' but solid
// rather than tinted, since it's a materially more serious state (writes
// are actually blocked now, not just approaching).
const SEVERITY_CLASSES: Record<'low' | 'medium' | 'high', string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-warning/20 text-warning-foreground',
  high: 'bg-destructive/20 text-destructive',
};

export function TrialBanner({ accessState }: { accessState: TenantAccessState }) {
  if (accessState.status === 'active') {
    return null;
  }

  if (accessState.status === 'trial_ending') {
    return (
      <div
        className={cn(
          'flex h-8 shrink-0 items-center justify-center px-4 text-center text-xs font-medium',
          SEVERITY_CLASSES[accessState.severity],
        )}
      >
        Premium access ends in {accessState.daysRemaining} day{accessState.daysRemaining === 1 ? '' : 's'} — ask an
        administrator to renew it.
      </div>
    );
  }

  return (
    <div className="bg-destructive text-destructive-foreground flex h-8 shrink-0 items-center justify-center px-4 text-center text-xs font-medium">
      Premium access has expired. Everyone else is signed out until it&rsquo;s renewed, and this cooperative&rsquo;s
      data will be permanently deleted if it isn&rsquo;t renewed soon.
    </div>
  );
}
