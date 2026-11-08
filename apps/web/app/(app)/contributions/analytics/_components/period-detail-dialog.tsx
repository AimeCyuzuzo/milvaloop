'use client';

import { useState } from 'react';
import type { AnalyticsMemberRow, AnalyticsPeriodRow } from '@milvaloop/types';

import { Button } from '@milvaloop/ui/button';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from '@milvaloop/ui/responsive-dialog';

import { formatPeriodLabel } from '@/lib/contributions/format-period';

import { PeriodStatusRows, type PeriodStatusRow } from '../../_components/period-status-rows';

// A period row's own drill-down: every member's status for that one
// month, pivoted client-side from the same per-member period history the
// "every member" table already has (see
// ContributionsService.getAnalytics's `members[].periods`) — the counts
// on the row itself are exactly the tally of what this lists.
export function PeriodDetailDialog({ period, members }: { period: AnalyticsPeriodRow; members: AnalyticsMemberRow[] }) {
  const [open, setOpen] = useState(false);

  const rows: PeriodStatusRow[] = members.flatMap((member) => {
    const entry = member.periods.find((candidate) => candidate.period === period.period);
    return entry ? [{ key: member.membershipId, label: member.name, period: entry }] : [];
  });

  return (
    <ResponsiveDialog open={open} onOpenChange={setOpen}>
      <ResponsiveDialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm">
          View
        </Button>
      </ResponsiveDialogTrigger>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{formatPeriodLabel(period.period)}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {period.totalMembers} member{period.totalMembers === 1 ? '' : 's'}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <PeriodStatusRows rows={rows} />
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
