'use client';

import type { ComplianceSummary } from '@milvaloop/types';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@milvaloop/ui/card';
import { Skeleton } from '@milvaloop/ui/skeleton';
import { Typography } from '@milvaloop/ui/typography';

import { formatPeriodLabel } from '@/lib/contributions/format-period';
import { useComplianceSummaryQuery } from '@/lib/contributions/use-compliance-summary-query';
import { useShareSettingsQuery } from '@/lib/contributions/use-share-settings-query';

// Part-to-whole with 4 reserved status colors (see the dataviz skill's
// "status" job — a stacked bar, not a pie: reading angle is harder than
// reading a segment's share of one row). Same satisfied/partial/due/
// overdue palette PeriodComplianceChart already uses on the Analytics
// page, so a color never means something different depending which
// screen you're on.
const SEGMENTS: Array<{ key: 'satisfied' | 'partial' | 'due' | 'overdue'; label: string; color: string }> = [
  { key: 'satisfied', label: 'Satisfied', color: 'var(--success)' },
  { key: 'partial', label: 'Partial', color: 'var(--warning)' },
  { key: 'due', label: 'Due', color: 'var(--muted-foreground)' },
  { key: 'overdue', label: 'Overdue', color: 'var(--destructive)' },
];

export function ThisMonthComplianceBar() {
  const { data: settings } = useShareSettingsQuery();
  const { data: compliance, isPending } = useComplianceSummaryQuery(Boolean(settings?.current));

  if (!settings?.current || isPending || !compliance) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>This month&rsquo;s compliance</CardTitle>
          <CardDescription>Every active member&rsquo;s status, at a glance.</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  return <ComplianceBarContent compliance={compliance} />;
}

function ComplianceBarContent({ compliance }: { compliance: ComplianceSummary }) {
  const total = compliance.totalMembers;

  return (
    <Card>
      <CardHeader>
        <CardTitle>This month&rsquo;s compliance</CardTitle>
        <CardDescription>Every active member&rsquo;s status for {formatPeriodLabel(compliance.period)}, at a glance.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {total === 0 ? (
          <Typography variant="muted">No active members yet.</Typography>
        ) : (
          <>
            <div className="flex h-4 w-full gap-0.5 overflow-hidden rounded-full">
              {SEGMENTS.map((segment) => {
                const count = compliance[segment.key];
                if (count === 0) {
                  return null;
                }
                return (
                  <div
                    key={segment.key}
                    className="h-full"
                    style={{ width: `${(count / total) * 100}%`, backgroundColor: segment.color }}
                  />
                );
              })}
            </div>
            {/* 4 status segments — direct labels are mandatory at this
                count (see the dataviz skill's series-count ladder), not
                just a legend someone has to cross-reference. */}
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {SEGMENTS.map((segment) => (
                <div key={segment.key} className="flex items-center gap-2">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: segment.color }} />
                  <Typography variant="small">
                    {segment.label}: {compliance[segment.key]}
                  </Typography>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
