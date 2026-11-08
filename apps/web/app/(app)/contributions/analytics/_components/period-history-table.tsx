import type { AnalyticsMemberRow, AnalyticsPeriodRow } from '@milvaloop/types';

import { Card, CardContent } from '@milvaloop/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@milvaloop/ui/table';
import { Typography } from '@milvaloop/ui/typography';

import { formatPeriodLabel } from '@/lib/contributions/format-period';

import { PeriodDetailDialog } from './period-detail-dialog';

// Every period since the cooperative's first share price, oldest first —
// unlike the dashboard's compliance-summary card, which only ever shows
// the current month, this is the full compliance history at a glance.
// `members` is only needed for PeriodDetailDialog's own drill-down — this
// table's own cells never read anything off it directly. Hand-rolled
// rather than the generic DataTable (no sorting/filtering/pagination
// needed for a handful of months), so the mobile card fallback is its own
// small parallel render here instead of DataTable's shared one.
export function PeriodHistoryTable({ periods, members }: { periods: AnalyticsPeriodRow[]; members: AnalyticsMemberRow[] }) {
  if (periods.length === 0) {
    return (
      <Typography variant="small" color="muted">
        No periods yet.
      </Typography>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3 md:hidden">
        {periods.map((period) => (
          <Card key={period.period}>
            <CardContent className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <Typography>{formatPeriodLabel(period.period)}</Typography>
                <PeriodDetailDialog period={period} members={members} />
              </div>
              <div className="text-muted-foreground grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <span>Members: {period.totalMembers}</span>
                <span>Satisfied: {period.satisfied}</span>
                <span>Partial: {period.partial}</span>
                <span>Due: {period.due}</span>
                <span>Overdue: {period.overdue}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-xl md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Period</TableHead>
              <TableHead>Members</TableHead>
              <TableHead>Satisfied</TableHead>
              <TableHead>Partial</TableHead>
              <TableHead>Due</TableHead>
              <TableHead>Overdue</TableHead>
              <TableHead />
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
                <TableCell>
                  <PeriodDetailDialog period={period} members={members} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
