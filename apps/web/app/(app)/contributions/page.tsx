'use client';

import { PERMISSIONS } from '@milvaloop/types';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@milvaloop/ui/card';
import { Skeleton } from '@milvaloop/ui/skeleton';
import { Typography } from '@milvaloop/ui/typography';

import { useHasPermission } from '@/lib/auth/use-permissions';
import { formatAmount } from '@/lib/contributions/format-period';
import { useShareSettingsQuery } from '@/lib/contributions/use-share-settings-query';

import { ContributionsTable } from './_components/contributions-table';
import { MemberSummaryCard } from './_components/member-summary-card';
import { RecordContributionDialog } from './_components/record-contribution-dialog';
import { SetSharePriceDialog } from './_components/set-share-price-dialog';

// The page title/description live in the app shell's top bar (see
// AppLayout + page-headers.ts), not here — this page only owns its content.
export default function ContributionsPage() {
  const { data: settings, isPending } = useShareSettingsQuery();
  const canRecord = useHasPermission(PERMISSIONS.CONTRIBUTIONS_RECORD);
  const canManageSettings = useHasPermission(PERMISSIONS.CONTRIBUTIONS_SETTINGS);

  if (isPending) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  // No share price yet — nothing else in this feature can work without
  // one, so the whole page becomes a setup prompt rather than a broken or
  // empty ledger (see DESIGN.md's "no dead ends").
  if (!settings?.current) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Set up contributions</CardTitle>
          <CardDescription>Set your cooperative&rsquo;s share price to start tracking monthly contributions.</CardDescription>
        </CardHeader>
        <CardContent>
          {canManageSettings ? (
            <SetSharePriceDialog triggerLabel="Set up contributions" />
          ) : (
            <Typography variant="small" color="muted">
              Ask an admin to set this up.
            </Typography>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Typography variant="small" color="muted">
          Share price: {formatAmount(settings.current.amount)}
        </Typography>
        <div className="flex items-center gap-2">
          {canManageSettings ? <SetSharePriceDialog triggerLabel="Change share price" /> : null}
          {canRecord ? <RecordContributionDialog /> : null}
        </div>
      </div>

      <MemberSummaryCard />

      <ContributionsTable />
    </div>
  );
}
