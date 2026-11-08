import type { ColumnDef, Row } from '@tanstack/react-table';
import type { ContributionListItem } from '@milvaloop/types';

import { Badge } from '@milvaloop/ui/badge';
import { Card, CardContent } from '@milvaloop/ui/card';
import { Checkbox } from '@milvaloop/ui/checkbox';
import { Typography } from '@milvaloop/ui/typography';

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
    accessorFn: (row) => row.member.name,
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
    accessorFn: (row) => row.recordedBy.name,
    header: 'Recorded by',
  },
  {
    id: 'actions',
    enableSorting: false,
    cell: ({ row }) => <ContributionRowActions contribution={row.original} />,
  },
];

// Below md, DataTable renders this instead of a horizontally-scrolling
// row (see contributions-table.tsx). The row's own selection state is
// used directly — DataTable owns row selection regardless of which UI
// reads/writes it — so bulk approve/reject still works on mobile.
export function renderContributionMobileCard(row: Row<ContributionListItem>) {
  const contribution = row.original;
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <Checkbox
            className="mt-0.5 size-5"
            checked={row.getIsSelected()}
            onCheckedChange={(checked) => row.toggleSelected(Boolean(checked))}
            aria-label="Select row"
          />
          <div className="min-w-0 flex-1">
            <Typography className="truncate">{contribution.member.name}</Typography>
            <Typography variant="small" color="muted" className="truncate">
              {formatAmount(contribution.amount)} · {formatDate(contribution.contributedAt)}
            </Typography>
          </div>
          <ContributionRowActions contribution={contribution} />
        </div>
        <div className="flex items-center justify-between gap-2">
          <Badge variant={STATUS_BADGE_VARIANT[contribution.status]}>{capitalize(contribution.status)}</Badge>
          <Typography variant="small" color="muted" className="truncate">
            Recorded by {contribution.recordedBy.name}
          </Typography>
        </div>
      </CardContent>
    </Card>
  );
}
