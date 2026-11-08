'use client';

import Link from 'next/link';

import { Button } from '@milvaloop/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@milvaloop/ui/card';
import { Skeleton } from '@milvaloop/ui/skeleton';
import { Typography } from '@milvaloop/ui/typography';

import { describeAuditEvent } from '@/lib/audit/describe-audit-event';
import { useAuditEventsQuery } from '@/lib/audit/use-audit-events-query';

const RECENT_EVENTS_SHOWN = 5;

export function RecentActivityCard() {
  const { data, isPending } = useAuditEventsQuery();
  const recent = data?.events.slice(0, RECENT_EVENTS_SHOWN) ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent activity</CardTitle>
        <CardDescription>What&rsquo;s happened in this cooperative.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {isPending ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
          </div>
        ) : recent.length === 0 ? (
          <Typography variant="small" color="muted">
            Nothing has happened here yet.
          </Typography>
        ) : (
          <div className="flex flex-col gap-2">
            {recent.map((event) => (
              <Typography key={event.id} variant="small">
                {describeAuditEvent(event)}
              </Typography>
            ))}
          </div>
        )}
        <div className="w-fit">
          <Button asChild variant="outline" size="sm">
            <Link href="/activity">View all activity</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
