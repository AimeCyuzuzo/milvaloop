'use client';

import Link from 'next/link';

import { Button } from '@milvaloop/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@milvaloop/ui/card';
import { DataTable } from '@milvaloop/ui/data-table';
import { Skeleton } from '@milvaloop/ui/skeleton';
import { Typography } from '@milvaloop/ui/typography';

import { ExportButton } from '@/components/export-button';
import { useAnalyticsQuery } from '@/lib/contributions/use-analytics-query';
import { useShareSettingsQuery } from '@/lib/contributions/use-share-settings-query';

import { AnalyticsTotalsCards } from './_components/analytics-totals-cards';
import { memberAnalyticsColumns } from './_components/member-analytics-columns';
import { PeriodComplianceChart } from './_components/period-compliance-chart';
import { PeriodHistoryTable } from './_components/period-history-table';

// The tenant-wide "everything in one place" report — every number the
// ledger can produce, so reading it never requires adding periods or
// members up by hand (see ContributionsService.getAnalytics). Fully
// transparent, same as the rest of contributions: it aggregates numbers
// any member could already see one at a time via the Contributions page.
export default function ContributionsAnalyticsPage() {
  const { data: settings, isPending: isSettingsPending } = useShareSettingsQuery();
  const { data: analytics, isPending: isAnalyticsPending } = useAnalyticsQuery(Boolean(settings?.current));

  if (isSettingsPending) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!settings?.current) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Nothing to report yet</CardTitle>
          <CardDescription>Set your cooperative&rsquo;s share price before there&rsquo;s anything to analyze.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="w-fit">
            <Button asChild variant="outline">
              <Link href="/contributions">Back to Contributions</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isAnalyticsPending || !analytics) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Typography variant="small" color="muted">
          As of {analytics.asOfPeriod}
        </Typography>
        <ExportButton path="/contributions/analytics/export" label="Export as Excel" />
      </div>

      <AnalyticsTotalsCards totals={analytics.totals} />

      <Card>
        <CardHeader>
          <CardTitle>Compliance by month</CardTitle>
          <CardDescription>Every period since the cooperative started tracking contributions.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <PeriodComplianceChart periods={analytics.periods} />
          <PeriodHistoryTable periods={analytics.periods} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Every member</CardTitle>
          <CardDescription>Shares, cost basis, current value, and this month&rsquo;s status, side by side.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={memberAnalyticsColumns}
            data={analytics.members}
            filterPlaceholder="Search members…"
          />
        </CardContent>
      </Card>
    </div>
  );
}
