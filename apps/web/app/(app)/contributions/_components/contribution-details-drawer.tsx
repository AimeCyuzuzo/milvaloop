'use client';

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@milvaloop/ui/sheet';
import { Skeleton } from '@milvaloop/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@milvaloop/ui/table';
import { Typography } from '@milvaloop/ui/typography';

import { formatAmount, formatPeriodLabel } from '@/lib/contributions/format-period';
import { useContributionDetailQuery } from '@/lib/contributions/use-contribution-detail-query';

// What a contribution's own row can't show on its own: which periods it
// actually settles. A lump sum covering several months (a live top-up
// paying off several outstanding periods at once) reads as one number in
// the ledger; this breaks it back down using data that's already been
// sitting in contribution_allocations since the moment it was recorded
// (see ContributionsService.getContributionDetail) — nothing new is
// computed here, just exposed.
export function ContributionDetailsDrawer({
  contributionId,
  open,
  onOpenChange,
}: {
  contributionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isPending } = useContributionDetailQuery(contributionId, open);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Contribution details</SheetTitle>
          <SheetDescription>
            {data ? `${data.contribution.member.name}'s ${formatAmount(data.contribution.amount)} contribution` : 'What this covers.'}
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4">
          {isPending || !data ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <>
              {/* Table already wraps itself in its own overflow-x-auto
                  container (see table.tsx) — the sheet stays at the app's
                  usual drawer width (see edit-permissions-sheet.tsx)
                  rather than widening just for this table, and a narrow
                  screen scrolls the table itself to see every column. */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Price</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.allocations.map((allocation) => (
                    <TableRow key={allocation.period}>
                      <TableCell className="whitespace-nowrap">{formatPeriodLabel(allocation.period)}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatAmount(allocation.amount)}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatAmount(allocation.sharePriceAmount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Typography variant="muted">
                {data.currentlySatisfiedThroughPeriod
                  ? `${data.contribution.member.name} is currently caught up through ${formatPeriodLabel(data.currentlySatisfiedThroughPeriod)}.`
                  : `${data.contribution.member.name} doesn't have a fully caught-up month yet.`}
              </Typography>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
