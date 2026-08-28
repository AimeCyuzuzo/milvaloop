'use client';

import Link from 'next/link';
import { PERMISSIONS } from '@milvaloop/types';

import { Button } from '@milvaloop/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@milvaloop/ui/card';
import { Typography } from '@milvaloop/ui/typography';

import { useHasPermission } from '@/lib/auth/use-permissions';
import { formatAmount } from '@/lib/contributions/format-period';
import { useComplianceSummaryQuery } from '@/lib/contributions/use-compliance-summary-query';
import { useContributionsQuery } from '@/lib/contributions/use-contributions-query';
import { useShareSettingsQuery } from '@/lib/contributions/use-share-settings-query';
import { useMembersQuery } from '@/lib/members/use-members-query';

// Four numbers, each answering a question someone opening the app
// actually has: who's here, what a share costs, is anything waiting on
// me, and is this month going well. Nothing here is computed client-side
// beyond a count — every number comes straight from an endpoint that
// already exists for its own feature page.
export function SummaryCards() {
  const { data: membersData } = useMembersQuery();
  const { data: settings } = useShareSettingsQuery();
  const { data: pending } = useContributionsQuery({ status: 'pending' });
  const { data: compliance } = useComplianceSummaryQuery(Boolean(settings?.current));
  const canApprove = useHasPermission(PERMISSIONS.CONTRIBUTIONS_APPROVE);

  const activeMemberCount = membersData?.members.filter((member) => member.status === 'active').length ?? 0;
  const pendingCount = pending?.contributions.length ?? 0;
  const pendingNeedsAttention = pendingCount > 0 && canApprove;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader>
          <CardDescription>Members</CardDescription>
          <CardTitle size="lg">{activeMemberCount}</CardTitle>
        </CardHeader>
        <CardContent>
          <Typography variant="muted">
            Active members in this cooperative.
          </Typography>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardDescription>Share price</CardDescription>
          <CardTitle size="lg">{settings?.current ? formatAmount(settings.current.amount) : 'Not set up'}</CardTitle>
        </CardHeader>
        <CardContent>
          <Typography variant="muted">
            What one share currently costs.
          </Typography>
        </CardContent>
      </Card>

      <Card variant={pendingNeedsAttention ? 'highlighted' : 'default'}>
        <CardHeader>
          <CardDescription>Pending approvals</CardDescription>
          <CardTitle size="lg">{pendingCount}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Typography variant="muted">
            Contributions recorded but not yet confirmed.
          </Typography>
          {pendingNeedsAttention ? (
            <div className="w-fit">
              <Button asChild size="sm" variant="outline">
                <Link href="/contributions">Review</Link>
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardDescription>This month</CardDescription>
          <CardTitle size="lg">
            {compliance ? `${compliance.satisfied}/${compliance.totalMembers} satisfied` : '—'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Typography variant="muted">
            Satisfied vs. total members, this calendar month only.
          </Typography>
        </CardContent>
      </Card>
    </div>
  );
}
