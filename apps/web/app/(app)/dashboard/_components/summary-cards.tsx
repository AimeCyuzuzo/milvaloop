'use client';

import Link from 'next/link';
import { CalendarCheck, Clock, Coins, Users, Wallet } from 'lucide-react';
import { PERMISSIONS } from '@milvaloop/types';

import { Button } from '@milvaloop/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@milvaloop/ui/card';
import { Typography } from '@milvaloop/ui/typography';

import { useHasPermission } from '@/lib/auth/use-permissions';
import { formatAmount } from '@/lib/contributions/format-period';
import { useAnalyticsQuery } from '@/lib/contributions/use-analytics-query';
import { useComplianceSummaryQuery } from '@/lib/contributions/use-compliance-summary-query';
import { useContributionsQuery } from '@/lib/contributions/use-contributions-query';
import { useShareSettingsQuery } from '@/lib/contributions/use-share-settings-query';
import { useMembersQuery } from '@/lib/members/use-members-query';

// Every color here is one of this app's own existing semantic tokens at low
// opacity (see Card's `primary`/`success`/`warning` variants) — never a new
// hue, so this stays correct in both themes and never drifts from the rest
// of the design system's palette.
const ICON_BADGE_CLASSES = {
  primary: 'bg-primary/15 text-primary',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
} as const;

function IconBadge({ icon: Icon, tone }: { icon: React.ComponentType<{ className?: string }>; tone: keyof typeof ICON_BADGE_CLASSES }) {
  return (
    <div className={`flex size-9 items-center justify-center rounded-full ${ICON_BADGE_CLASSES[tone]}`}>
      <Icon className="size-4" />
    </div>
  );
}

// Five numbers, in the order someone opening the app actually cares about
// them: how much has come in overall, is this month going well, what a
// share costs, who's here, and is anything waiting on me. Nothing here is
// computed client-side beyond a count — every number comes straight from an
// endpoint that already exists for its own feature page.
export function SummaryCards() {
  const { data: membersData } = useMembersQuery();
  const { data: settings } = useShareSettingsQuery();
  const { data: pending } = useContributionsQuery({ status: 'pending' });
  const { data: compliance } = useComplianceSummaryQuery(Boolean(settings?.current));
  const { data: analytics } = useAnalyticsQuery(Boolean(settings?.current));
  const canApprove = useHasPermission(PERMISSIONS.CONTRIBUTIONS_APPROVE);

  const activeMemberCount = membersData?.members.filter((member) => member.status === 'active').length ?? 0;
  const pendingCount = pending?.contributions.length ?? 0;
  const pendingNeedsAttention = pendingCount > 0 && canApprove;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <Card variant="success">
        <CardHeader>
          <IconBadge icon={Wallet} tone="success" />
          <div>
            <Typography variant="muted">Total contributed</Typography>
            <CardTitle size="lg">{analytics ? formatAmount(analytics.totals.totalCostBasis) : '—'}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <Typography variant="muted">Every approved contribution, all-time.</Typography>
        </CardContent>
      </Card>

      <Card variant="primary">
        <CardHeader>
          <IconBadge icon={CalendarCheck} tone="primary" />
          <div>
            <Typography variant="muted">This month</Typography>
            <CardTitle size="lg">{compliance ? `${compliance.satisfied}/${compliance.totalMembers} satisfied` : '—'}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <Typography variant="muted">Satisfied vs. total members, this calendar month only.</Typography>
        </CardContent>
      </Card>

      <Card variant="warning">
        <CardHeader>
          <IconBadge icon={Coins} tone="warning" />
          <div>
            <Typography variant="muted">Share price</Typography>
            <CardTitle size="lg">{settings?.current ? formatAmount(settings.current.amount) : 'Not set up'}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <Typography variant="muted">What one share currently costs.</Typography>
        </CardContent>
      </Card>

      <Card variant="primary">
        <CardHeader>
          <IconBadge icon={Users} tone="primary" />
          <div>
            <Typography variant="muted">Members</Typography>
            <CardTitle size="lg">{activeMemberCount}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <Typography variant="muted">Active members in this cooperative.</Typography>
        </CardContent>
      </Card>

      <Card variant={pendingNeedsAttention ? 'highlighted' : 'default'}>
        <CardHeader>
          <IconBadge icon={Clock} tone="warning" />
          <div>
            <Typography variant="muted">Pending approvals</Typography>
            <CardTitle size="lg">{pendingCount}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Typography variant="muted">Contributions recorded but not yet confirmed.</Typography>
          {pendingNeedsAttention ? (
            <div className="w-fit">
              <Button asChild size="sm" variant="outline">
                <Link href="/contributions">Review</Link>
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
