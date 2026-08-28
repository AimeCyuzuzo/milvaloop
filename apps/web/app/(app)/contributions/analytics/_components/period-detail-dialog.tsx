'use client';

import { useState } from 'react';
import type { AnalyticsMemberRow, AnalyticsPeriodRow } from '@milvaloop/types';

import { Button } from '@milvaloop/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@milvaloop/ui/dialog';

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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm">
          View
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{formatPeriodLabel(period.period)}</DialogTitle>
          <DialogDescription>
            {period.totalMembers} member{period.totalMembers === 1 ? '' : 's'}
          </DialogDescription>
        </DialogHeader>
        <PeriodStatusRows rows={rows} />
      </DialogContent>
    </Dialog>
  );
}
