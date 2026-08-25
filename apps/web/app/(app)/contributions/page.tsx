'use client';

import Link from 'next/link';
import { PERMISSIONS } from '@milvaloop/types';

import { Button } from '@milvaloop/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@milvaloop/ui/card';
import { Skeleton } from '@milvaloop/ui/skeleton';
import { Typography } from '@milvaloop/ui/typography';

import { useHasPermission } from '@/lib/auth/use-permissions';
import { formatAmount } from '@/lib/contributions/format-period';
import { useMyMembershipId } from '@/lib/members/use-my-membership';
import { useShareSettingsQuery } from '@/lib/contributions/use-share-settings-query';

import { ContributionsTable } from './_components/contributions-table';
import { MemberSummaryCard } from './_components/member-summary-card';
import { RecordContributionDialog } from './_components/record-contribution-dialog';

// The page title/description live in the app shell's top bar (see
// AppLayout + page-headers.ts), not here — this page only owns its content.
// Setting or changing the share price itself lives on Settings, not here —
// one home for that action rather than two (see settings/page.tsx).
export default function ContributionsPage() {
  const { data: settings, isPending } = useShareSettingsQuery();
  const canRecordForOthers = useHasPermission(PERMISSIONS.CONTRIBUTIONS_RECORD);
  const canManageSettings = useHasPermission(PERMISSIONS.CONTRIBUTIONS_SETTINGS);
  const myMembershipId = useMyMembershipId();

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
            <div className="w-fit">
              <Button asChild>
                <Link href="/settings">Go to Settings</Link>
              </Button>
            </div>
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
        {canRecordForOthers ? (
          <RecordContributionDialog triggerLabel="Record a contribution" />
        ) : myMembershipId ? (
          <RecordContributionDialog
            triggerLabel="Record my contribution"
            fixedMembershipId={myMembershipId}
            defaultAmount={settings.current.amount}
            detailsDescription="How much did you pay, and when? An admin will confirm it before it counts."
            showAdvanced={false}
          />
        ) : null}
      </div>

      <MemberSummaryCard />

      <ContributionsTable />
    </div>
  );
}
