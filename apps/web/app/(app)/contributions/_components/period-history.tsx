'use client';

import { useState } from 'react';

import { Button } from '@milvaloop/ui/button';

import { PeriodStatusRows, type PeriodStatusRow } from './period-status-rows';

// How many of the most recent rows stay visible without tapping anything —
// the current period plus SUMMARY_LOOKAHEAD_MONTHS upcoming ones (see
// ContributionsService), the only rows anyone needs at a glance. A
// cooperative's history only ever grows, so without a fold this list would
// eventually be a long, low-signal scroll of settled months before you
// reach the part that actually matters right now.
const DEFAULT_VISIBLE_COUNT = 3;

// One member's period-by-period history, oldest first (see
// ContributionsService.getMemberSummary) — shared by MemberSummaryCard's
// own view and MemberDetailDialog's drill-down, the two places this
// specific "one member across time" shape shows up. PeriodDetailDialog's
// "one period across every member" rows have no such chronological fold to
// make and render PeriodStatusRows directly instead.
export function PeriodHistory({ rows }: { rows: PeriodStatusRow[] }) {
  const [expanded, setExpanded] = useState(false);

  if (rows.length <= DEFAULT_VISIBLE_COUNT) {
    return <PeriodStatusRows rows={rows} />;
  }

  const hiddenCount = rows.length - DEFAULT_VISIBLE_COUNT;
  const earlierRows = rows.slice(0, hiddenCount);
  const visibleRows = rows.slice(hiddenCount);

  return (
    <div className="flex flex-col gap-3">
      <Button type="button" variant="ghost" size="sm" className="self-start" onClick={() => setExpanded((value) => !value)}>
        {expanded ? 'Hide earlier months' : `Show ${hiddenCount} earlier month${hiddenCount === 1 ? '' : 's'}`}
      </Button>
      {expanded ? <PeriodStatusRows rows={earlierRows} /> : null}
      <PeriodStatusRows rows={visibleRows} />
    </div>
  );
}
