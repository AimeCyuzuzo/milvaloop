'use client';

import { useState } from 'react';
import type { AnalyticsMemberRow } from '@milvaloop/types';

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

import { PeriodStatusRows } from '../../_components/period-status-rows';

// A member row's own drill-down: their full period-by-period history,
// already included on the row itself (see
// ContributionsService.getAnalytics's `members[].periods`) — no separate
// request the way MemberSummaryCard's own picker needs one.
export function MemberDetailDialog({ member }: { member: AnalyticsMemberRow }) {
  const [open, setOpen] = useState(false);

  return (
    <ResponsiveDialog open={open} onOpenChange={setOpen}>
      <ResponsiveDialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm">
          View
        </Button>
      </ResponsiveDialogTrigger>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{member.name}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>{member.email}</ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <PeriodStatusRows
          rows={member.periods.map((period) => ({
            key: period.period,
            label: formatPeriodLabel(period.period),
            period,
          }))}
        />
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
