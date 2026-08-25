'use client';

import { useState } from 'react';
import type { ContributionStatus } from '@milvaloop/types';

import { DataTable } from '@milvaloop/ui/data-table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@milvaloop/ui/select';
import { Skeleton } from '@milvaloop/ui/skeleton';

import { ExportButton } from '@/components/export-button';
import { useContributionsQuery } from '@/lib/contributions/use-contributions-query';

import { contributionColumns } from './contributions-columns';

type StatusFilter = ContributionStatus | 'all';

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All' },
];

// Every active member can see this table regardless of status — the
// transparency decision behind the feature — the status filter only
// changes what's shown, never who can see it.
export function ContributionsTable() {
  const [status, setStatus] = useState<StatusFilter>('pending');
  const { data, isPending } = useContributionsQuery(status === 'all' ? {} : { status });

  const filterControl = (
    <div className="flex items-center gap-2">
      <div className="w-36">
        <Select value={status} onValueChange={(value) => setStatus(value as StatusFilter)}>
          <SelectTrigger size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <ExportButton
        path={status === 'all' ? '/contributions/export' : `/contributions/export?status=${status}`}
        label="Export"
      />
    </div>
  );

  if (isPending) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <DataTable
      columns={contributionColumns}
      data={data?.contributions ?? []}
      filterPlaceholder="Search contributions…"
      filters={filterControl}
    />
  );
}
