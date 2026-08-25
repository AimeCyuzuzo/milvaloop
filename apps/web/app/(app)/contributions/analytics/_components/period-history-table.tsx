import type { AnalyticsPeriodRow } from '@milvaloop/types';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@milvaloop/ui/table';
import { Typography } from '@milvaloop/ui/typography';

import { formatPeriodLabel } from '@/lib/contributions/format-period';

// Every period since the cooperative's first share price, oldest first —
// unlike the dashboard's compliance-summary card, which only ever shows
// the current month, this is the full compliance history at a glance.
export function PeriodHistoryTable({ periods }: { periods: AnalyticsPeriodRow[] }) {
  if (periods.length === 0) {
    return (
      <Typography variant="small" color="muted">
        No periods yet.
      </Typography>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Period</TableHead>
          <TableHead>Members</TableHead>
          <TableHead>Satisfied</TableHead>
          <TableHead>Partial</TableHead>
          <TableHead>Due</TableHead>
          <TableHead>Overdue</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {periods.map((period) => (
          <TableRow key={period.period}>
            <TableCell>{formatPeriodLabel(period.period)}</TableCell>
            <TableCell>{period.totalMembers}</TableCell>
            <TableCell>{period.satisfied}</TableCell>
            <TableCell>{period.partial}</TableCell>
            <TableCell>{period.due}</TableCell>
            <TableCell>{period.overdue}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
