'use client';

import { useState } from 'react';
import type { AnalyticsMemberRow } from '@milvaloop/types';

import { Button } from '@milvaloop/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@milvaloop/ui/dialog';

import { formatPeriodLabel } from '@/lib/contributions/format-period';

import { PeriodStatusRows } from '../../_components/period-status-rows';

// A member row's own drill-down: their full period-by-period history,
// already included on the row itself (see
// ContributionsService.getAnalytics's `members[].periods`) — no separate
// request the way MemberSummaryCard's own picker needs one.
export function MemberDetailDialog({ member }: { member: AnalyticsMemberRow }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm">
          View
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{member.name}</DialogTitle>
          <DialogDescription>{member.email}</DialogDescription>
        </DialogHeader>
        <PeriodStatusRows
          rows={member.periods.map((period) => ({
            key: period.period,
            label: formatPeriodLabel(period.period),
            period,
          }))}
        />
      </DialogContent>
    </Dialog>
  );
}
