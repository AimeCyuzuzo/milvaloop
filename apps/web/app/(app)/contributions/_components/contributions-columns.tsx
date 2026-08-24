import type { ColumnDef } from '@tanstack/react-table';
import type { ContributionListItem } from '@milvaloop/types';

import { Badge } from '@milvaloop/ui/badge';

import { formatAmount, formatDate } from '@/lib/contributions/format-period';

import { ContributionRowActions } from './contribution-row-actions';

const STATUS_BADGE_VARIANT = {
  pending: 'warningSoft',
  approved: 'successSoft',
  rejected: 'destructiveSoft',
} as const;

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export const contributionColumns: ColumnDef<ContributionListItem>[] = [
  {
    id: 'member',
    accessorFn: (row) => row.member.email,
    header: 'Member',
  },
  {
    accessorKey: 'amount',
    header: 'Amount',
    cell: ({ getValue }) => formatAmount(getValue<number>()),
  },
  {
    id: 'contributedAt',
    accessorFn: (row) => row.contributedAt,
    header: 'Date paid',
    cell: ({ getValue }) => formatDate(getValue<string>()),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ getValue }) => {
      const status = getValue<ContributionListItem['status']>();
      return <Badge variant={STATUS_BADGE_VARIANT[status]}>{capitalize(status)}</Badge>;
    },
  },
  {
    id: 'recordedBy',
    accessorFn: (row) => row.recordedBy.email,
    header: 'Recorded by',
  },
  {
    id: 'actions',
    enableSorting: false,
    cell: ({ row }) => <ContributionRowActions contribution={row.original} />,
  },
];
