'use client';

import Link from 'next/link';
import { FREE_PLAN_MEMBER_CAP } from '@milvaloop/types';

import { Button } from '@milvaloop/ui/button';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@milvaloop/ui/responsive-dialog';

// Shown instead of the normal add-member flow once a Free-plan cooperative
// is at FREE_PLAN_MEMBER_CAP (see MembersService.assertUnderFreePlanCap,
// which enforces the same limit on the backend regardless of whether this
// ever renders) — Premium has no member ceiling, just a per-10-member cost
// increase (see the pricing page), so there's nothing to confirm here
// beyond pointing at it.
export function UpgradeToPremiumDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Upgrade to Premium</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            The Free plan is limited to {FREE_PLAN_MEMBER_CAP} members. Premium has no member limit.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <ResponsiveDialogFooter>
          <Button asChild>
            <Link href="/pricing">See Premium pricing</Link>
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
