import type { ColumnDef } from '@tanstack/react-table';
import type { AnalyticsMemberRow } from '@milvaloop/types';

import { Badge } from '@milvaloop/ui/badge';

import { formatAmount } from '@/lib/contributions/format-period';
import { PERIOD_STATUS_BADGE_VARIANT, PERIOD_STATUS_LABEL } from '@/lib/contributions/period-status-labels';

export const memberAnalyticsColumns: ColumnDef<AnalyticsMemberRow>[] = [
  {
    accessorKey: 'email',
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
    accessorKey: 'currentValue',
    header: "Value at today's price",
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
];
