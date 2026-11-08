import type { ColumnDef, Row } from '@tanstack/react-table';
import type { AnalyticsMemberRow } from '@milvaloop/types';

import { Badge } from '@milvaloop/ui/badge';
import { Card, CardContent } from '@milvaloop/ui/card';
import { Typography } from '@milvaloop/ui/typography';

import { formatAmount } from '@/lib/contributions/format-period';
import { PERIOD_STATUS_BADGE_VARIANT, PERIOD_STATUS_LABEL } from '@/lib/contributions/period-status-labels';

import { MemberDetailDialog } from './member-detail-dialog';

export const memberAnalyticsColumns: ColumnDef<AnalyticsMemberRow>[] = [
  {
    accessorKey: 'name',
    header: 'Member',
  },
  {
    accessorKey: 'totalShares',
    header: 'Shares owned',
  },
  {
    accessorKey: 'costBasis',
    header: 'Total contributed',
    cell: ({ getValue }) => formatAmount(getValue<number>()),
  },
  {
    accessorKey: 'currentPeriodStatus',
    header: 'This month',
    cell: ({ getValue }) => {
      const status = getValue<AnalyticsMemberRow['currentPeriodStatus']>();
      if (!status) {
        return null;
      }
      return <Badge variant={PERIOD_STATUS_BADGE_VARIANT[status]}>{PERIOD_STATUS_LABEL[status]}</Badge>;
    },
  },
  {
    id: 'actions',
    enableSorting: false,
    cell: ({ row }) => <MemberDetailDialog member={row.original} />,
  },
];

// Below md, DataTable renders this instead of a horizontally-scrolling
// row (see analytics/page.tsx).
export function renderMemberAnalyticsMobileCard(row: Row<AnalyticsMemberRow>) {
  const member = row.original;
  return (
    <Card>
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <Typography className="truncate">{member.name}</Typography>
          <MemberDetailDialog member={member} />
        </div>
        <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <span>{member.totalShares} shares</span>
          <span>{formatAmount(member.costBasis)} total</span>
        </div>
        {member.currentPeriodStatus ? (
          <div>
            <Badge variant={PERIOD_STATUS_BADGE_VARIANT[member.currentPeriodStatus]}>
              {PERIOD_STATUS_LABEL[member.currentPeriodStatus]}
            </Badge>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
