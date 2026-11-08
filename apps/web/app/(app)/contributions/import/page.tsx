'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';

import { Alert, AlertDescription } from '@milvaloop/ui/alert';
import { Button } from '@milvaloop/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@milvaloop/ui/card';
import { useIsMobile } from '@milvaloop/ui/hooks/use-mobile';
import { Skeleton } from '@milvaloop/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@milvaloop/ui/table';
import { Typography } from '@milvaloop/ui/typography';

import { getErrorMessage } from '@/lib/api/api-fetch';
import { currentPeriod, formatAmount, formatPeriodLabel, toPeriodStart } from '@/lib/contributions/format-period';
import {
  applyBulkFill,
  applyEvenSplit,
  applyToCells,
  buildBaselineGrid,
  buildHistoricalEntries,
  cellKey,
  computeDeltaSummary,
  getCell,
  monthsBetween,
  setCell,
  type GridState,
} from '@/lib/contributions/historical-grid';
import { useAnalyticsQuery } from '@/lib/contributions/use-analytics-query';
import { useRecordHistoricalBatchMutation } from '@/lib/contributions/use-contribution-mutations';
import { useShareSettingsQuery } from '@/lib/contributions/use-share-settings-query';
import { useMembersQuery } from '@/lib/members/use-members-query';

import { AddHistoricalPriceDialog } from './_components/add-historical-price-dialog';
import { BulkFillDialog } from './_components/bulk-fill-dialog';
import { EvenSplitDialog } from './_components/even-split-dialog';
import { GridCellInput } from './_components/grid-cell-input';
import type { ImportMember } from './_components/member-checklist';
import { SelectionFillBar } from './_components/selection-fill-bar';

interface CellPosition {
  row: number;
  col: number;
}

// The periods×members grid: pick members, fill months by amount (see
// BulkFillDialog/EvenSplitDialog), click-and-shift-click a range of cells
// for a fast inline fill (see SelectionFillBar), or edit any cell
// directly — then save the whole thing in one batch. Every filled cell
// becomes one allocation line on that member's own historical
// contribution (see ContributionsService.recordHistoricalBatch); nothing
// is proposed or waterfalled, the grid states exactly what happened.
export default function ImportContributionsPage() {
  const isMobile = useIsMobile();
  const { data: membersData, isPending: membersPending } = useMembersQuery();
  const { data: settings, isPending: settingsPending } = useShareSettingsQuery();
  const { data: analytics, isPending: analyticsPending } = useAnalyticsQuery(Boolean(settings?.current));
  const recordBatch = useRecordHistoricalBatchMutation();
  const [grid, setGrid] = useState<GridState>(new Map());
  const [baseline, setBaseline] = useState<GridState>(new Map());
  const [baselineKey, setBaselineKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [anchor, setAnchor] = useState<CellPosition | null>(null);

  const members: ImportMember[] = useMemo(
    () =>
      (membersData?.members ?? [])
        .filter((member) => member.status === 'active')
        .map((member) => ({ membershipId: member.membershipId, name: member.name })),
    [membersData],
  );

  // The earliest known price on file — the only hard floor a period
  // actually needs to be recorded against (see
  // ContributionsService.resolveSharePriceIdForPeriod). A member's own
  // memberSince is deliberately not a floor here, since it defaults to
  // "today" for every real signup (including the founder) and
  // recordHistoricalBatch never checks it at write time; clamping to it
  // would make backfilling anyone's history from before they signed up
  // impossible, which defeats the point of this page. Every period the
  // grid shows is priced by construction — extending further back only
  // ever happens by adding a real, saved price (see
  // AddHistoricalPriceDialog), never a bare grid column.
  const earliestKnownPrice = useMemo(() => {
    const history = settings?.history ?? [];
    return history.reduce<(typeof history)[number] | null>(
      (earliest, price) => (!earliest || price.effectiveFrom < earliest.effectiveFrom ? price : earliest),
      null,
    );
  }, [settings]);

  const periods = useMemo(() => {
    const start = toPeriodStart(earliestKnownPrice?.effectiveFrom ?? currentPeriod());
    return monthsBetween(start, currentPeriod());
  }, [earliestKnownPrice]);

  const hasShareSettings = !!settings?.current;
  const deltaSummary = useMemo(() => computeDeltaSummary(grid, baseline), [grid, baseline]);

  // Seeds the grid from what's already recorded (see buildBaselineGrid)
  // whenever the period range genuinely changes — first load, or after
  // AddHistoricalPriceDialog extends it further back — rather than on
  // every analytics refetch, which would otherwise stomp on whatever the
  // member is mid-typing the next time TanStack Query refetches in the
  // background (e.g. a tab refocus). Re-keyed to null on a successful
  // save so the next "Import more" round re-seeds from the latest data.
  useEffect(() => {
    if (!analytics) {
      return;
    }
    const key = periods.join(',');
    if (key === baselineKey) {
      return;
    }
    const nextBaseline = buildBaselineGrid(analytics.members, periods);
    setBaseline(nextBaseline);
    setGrid(new Map(nextBaseline));
    setBaselineKey(key);
  }, [analytics, periods, baselineKey]);

  // Escape clears whatever's selected — a plain window listener rather
  // than a per-cell handler, since the selection can span the whole table
  // and there's no single element that's always focused while it's active.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setSelection(new Set());
        setAnchor(null);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  function handleCellSelect(row: number, col: number, event: React.MouseEvent) {
    const membershipId = members[row]?.membershipId;
    const period = periods[col];
    if (!membershipId || !period) {
      return;
    }
    if (event.shiftKey && anchor) {
      const rowStart = Math.min(anchor.row, row);
      const rowEnd = Math.max(anchor.row, row);
      const colStart = Math.min(anchor.col, col);
      const colEnd = Math.max(anchor.col, col);
      const keys = new Set<string>();
      for (let r = rowStart; r <= rowEnd; r += 1) {
        for (let c = colStart; c <= colEnd; c += 1) {
          const rowMembershipId = members[r]?.membershipId;
          const colPeriod = periods[c];
          if (rowMembershipId && colPeriod) {
            keys.add(cellKey(rowMembershipId, colPeriod));
          }
        }
      }
      setSelection(keys);
    } else {
      setSelection(new Set([cellKey(membershipId, period)]));
      setAnchor({ row, col });
    }
  }

  async function handleSave() {
    setError(null);
    const membershipIds = members.map((member) => member.membershipId);
    const entries = buildHistoricalEntries(grid, membershipIds, baseline);
    if (entries.length === 0) {
      setError('Fill at least one cell before saving.');
      return;
    }
    try {
      await recordBatch.mutateAsync({ entries });
      toast.success('History saved — awaiting approval.');
      // Re-seeds from the latest baseline on the next render rather than
      // clearing to blank — the just-submitted amounts stay pending until
      // approved (see buildBaselineGrid), so this mainly picks up anything
      // else that changed, but it means "Import more" never regresses to
      // the pre-fix blank-grid behavior this whole change exists to fix.
      setBaselineKey(null);
      setSaved(true);
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    }
  }

  // A members×months grid with shift-click range selection has no honest
  // mobile equivalent — not a smaller version of the same page, a
  // genuinely different (mouse-and-keyboard) tool. Rather than ship a
  // technically-scrollable but unusable spreadsheet, this says so plainly
  // and stops, before any of the states below ever get a chance to render
  // it. Recording a single contribution stays fully available on mobile
  // (see RecordContributionDialog) — only this bulk-backfill page needs a
  // bigger screen.
  if (isMobile) {
    return (
      <Alert>
        <AlertDescription>Importing history needs a bigger screen — please continue from a laptop or desktop.</AlertDescription>
      </Alert>
    );
  }

  // analytics is only enabled once a share price exists (see useAnalyticsQuery
  // above) — an enabled:false query never leaves TanStack Query's initial
  // pending status, so gating on it unconditionally would skeleton forever
  // on a cooperative that hasn't set one up yet, instead of falling through
  // to that message below.
  if (membersPending || settingsPending || (hasShareSettings && analyticsPending)) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (!hasShareSettings) {
    return (
      <Alert>
        <AlertDescription>
          Set up a share price before importing history — see{' '}
          <Link href="/settings" className="underline">
            Settings
          </Link>
          .
        </AlertDescription>
      </Alert>
    );
  }

  if (members.length === 0) {
    return (
      <Alert>
        <AlertDescription>
          Add at least one member before importing history — see{' '}
          <Link href="/members" className="underline">
            Members
          </Link>
          .
        </AlertDescription>
      </Alert>
    );
  }

  if (saved) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>History saved</CardTitle>
          <CardDescription>
            Each month you filled in is its own pending entry, the same as any other contribution — select several at
            once in the ledger to approve them together.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button asChild>
            <Link href="/contributions">Go to the ledger</Link>
          </Button>
          <Button variant="outline" onClick={() => setSaved(false)}>
            Import more
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <BulkFillDialog
          members={members}
          periods={periods}
          onApply={(membershipIds, amount, fillPeriods) => setGrid(applyBulkFill(grid, membershipIds, amount, fillPeriods, baseline))}
        />
        <EvenSplitDialog
          members={members}
          periods={periods}
          onApply={(membershipIds, totalAmount, fillPeriods) =>
            setGrid(applyEvenSplit(grid, membershipIds, totalAmount, fillPeriods, baseline))
          }
        />
        {earliestKnownPrice ? <AddHistoricalPriceDialog earliestKnownPrice={earliestKnownPrice} /> : null}
      </div>

      {selection.size > 0 ? (
        <SelectionFillBar
          count={selection.size}
          onFill={(amount) => setGrid(applyToCells(grid, [...selection], amount, baseline))}
          onClear={() => {
            setSelection(new Set());
            setAnchor(null);
          }}
        />
      ) : null}

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="bg-background sticky left-0">Member</TableHead>
              {periods.map((period) => (
                <TableHead key={period} className="whitespace-nowrap">
                  {formatPeriodLabel(period)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member, rowIndex) => (
              <TableRow key={member.membershipId}>
                <TableCell className="bg-background sticky left-0 font-medium whitespace-nowrap">{member.name}</TableCell>
                {periods.map((period, colIndex) => (
                  <TableCell key={period}>
                    <GridCellInput
                      value={getCell(grid, member.membershipId, period)}
                      onChange={(amount) => setGrid(setCell(grid, member.membershipId, period, amount))}
                      baseline={getCell(baseline, member.membershipId, period) ?? 0}
                      selected={selection.has(cellKey(member.membershipId, period))}
                      onSelect={(event) => handleCellSelect(rowIndex, colIndex, event)}
                    />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between gap-4">
        <Typography variant="small" color="muted">
          {deltaSummary.cellCount} cell{deltaSummary.cellCount === 1 ? '' : 's'} topped up — {formatAmount(deltaSummary.amount)} new
        </Typography>
        <Button onClick={() => void handleSave()} disabled={recordBatch.isPending || deltaSummary.cellCount === 0}>
          {recordBatch.isPending ? 'Saving…' : 'Save history'}
        </Button>
      </div>
    </div>
  );
}
