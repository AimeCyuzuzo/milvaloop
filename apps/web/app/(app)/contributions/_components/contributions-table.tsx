'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { PERMISSIONS, type ContributionStatus } from '@milvaloop/types';

import { Button } from '@milvaloop/ui/button';
import { DataTable } from '@milvaloop/ui/data-table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@milvaloop/ui/select';
import { Skeleton } from '@milvaloop/ui/skeleton';

import { ExportButton } from '@/components/export-button';
import { getErrorMessage } from '@/lib/api/api-fetch';
import { useHasPermission } from '@/lib/auth/use-permissions';
import { useApproveAllPendingMutation } from '@/lib/contributions/use-contribution-mutations';
import { useContributionsQuery } from '@/lib/contributions/use-contributions-query';

import { BulkActionsBar } from './bulk-actions-bar';
import { contributionColumns, renderContributionMobileCard } from './contributions-columns';

type StatusFilter = ContributionStatus | 'all';

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All' },
];

// Every active member can see this table regardless of status — the
// transparency decision behind the feature — the status filter only
// changes what's shown, never who can see it. Defaults to 'all' rather
// than 'pending' — a cooperative where everything happens to already be
// approved would otherwise open on what looks like an empty ledger, with
// nothing to say the rest is one filter away.
export function ContributionsTable() {
  const [status, setStatus] = useState<StatusFilter>('all');
  const { data, isPending } = useContributionsQuery(status === 'all' ? {} : { status });
  const canApprove = useHasPermission(PERMISSIONS.CONTRIBUTIONS_APPROVE);
  const approveAllPending = useApproveAllPendingMutation();

  async function handleApproveAll() {
    try {
      const { approved, failed } = await approveAllPending.mutateAsync();
      if (failed.length === 0) {
        toast.success(`Approved ${approved.length} contribution${approved.length === 1 ? '' : 's'}.`);
      } else {
        toast.warning(`Approved ${approved.length}, ${failed.length} need someone else to approve them.`);
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  const filterControl = (
    <div className="flex flex-wrap items-center gap-2">
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
      {canApprove && status === 'pending' && (data?.contributions.length ?? 0) > 0 ? (
        <Button variant="outline" size="sm" onClick={() => void handleApproveAll()} disabled={approveAllPending.isPending}>
          {approveAllPending.isPending ? 'Approving…' : 'Approve all pending'}
        </Button>
      ) : null}
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
      getRowId={(row) => row.id}
      mobileCard={renderContributionMobileCard}
      selectionActions={
        canApprove
          ? (selectedRows, clearSelection) => <BulkActionsBar selectedRows={selectedRows} clearSelection={clearSelection} />
          : undefined
      }
    />
  );
}
