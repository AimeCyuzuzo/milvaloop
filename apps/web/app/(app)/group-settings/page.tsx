'use client';

import Link from 'next/link';
import { FREE_PLAN_MEMBER_CAP, getTenantAccessState } from '@milvaloop/types';

import { Button } from '@milvaloop/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@milvaloop/ui/card';
import { Skeleton } from '@milvaloop/ui/skeleton';
import { Typography } from '@milvaloop/ui/typography';

import { formatDate } from '@/lib/contributions/format-period';
import { useCurrentSessionQuery } from '@/lib/auth/use-current-session';

// Cooperative-wide, not personal — a tenant's plan is the same answer for
// every member looking at it, unlike anything on Account (see that page's
// own comment on the same distinction). Ungated: Plan is read-only and
// transparent the same way Contributions/Activity are (see nav-items.ts),
// there's nothing here a member without a particular permission shouldn't
// see.
function PlanCard() {
  const { data: session } = useCurrentSessionQuery();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Plan</CardTitle>
      </CardHeader>
      <CardContent>
        {!session ? (
          <Skeleton className="h-6 w-full" />
        ) : session.tenant.plan === 'free' ? (
          <div className="flex items-center justify-between gap-4">
            <Typography variant="small">Free — up to {FREE_PLAN_MEMBER_CAP} members.</Typography>
            <Button asChild variant="outline" size="sm">
              <Link href="/pricing">See Premium pricing</Link>
            </Button>
          </div>
        ) : (
          <Typography variant="small">
            Premium —{' '}
            {getTenantAccessState(session.tenant).status === 'locked'
              ? `expired ${formatDate(session.tenant.premiumExpiresAt!)}. Changes are blocked until an administrator renews it.`
              : `active until ${formatDate(session.tenant.premiumExpiresAt!)}.`}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

export default function GroupSettingsPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <PlanCard />
    </div>
  );
}
