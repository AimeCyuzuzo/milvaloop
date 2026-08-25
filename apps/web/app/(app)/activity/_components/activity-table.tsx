'use client';

import { DataTable } from '@milvaloop/ui/data-table';
import { Skeleton } from '@milvaloop/ui/skeleton';

import { useAuditEventsQuery } from '@/lib/audit/use-audit-events-query';

import { activityColumns } from './activity-columns';

// Every active member can see this — full transparency, same as
// Contributions (see MAIN.md). There's no status filter here the way the
// contributions table has one: an audit trail has nothing to hide behind
// a default view, so it's just search + the columns' own sort.
export function ActivityTable() {
  const { data, isPending } = useAuditEventsQuery();

  if (isPending) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return <DataTable columns={activityColumns} data={data?.events ?? []} filterPlaceholder="Search activity…" />;
}
