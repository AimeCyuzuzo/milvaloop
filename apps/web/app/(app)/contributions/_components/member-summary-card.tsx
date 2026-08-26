'use client';

import { useState } from 'react';

import { Badge } from '@milvaloop/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@milvaloop/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@milvaloop/ui/select';
import { Skeleton } from '@milvaloop/ui/skeleton';
import { Typography } from '@milvaloop/ui/typography';

import { formatAmount, formatPeriodLabel } from '@/lib/contributions/format-period';
import { PERIOD_STATUS_BADGE_VARIANT, PERIOD_STATUS_LABEL } from '@/lib/contributions/period-status-labels';
import { useMemberSummaryQuery } from '@/lib/contributions/use-member-summary-query';
import { useMyMembershipId } from '@/lib/members/use-my-membership';
import { useMembersQuery } from '@/lib/members/use-members-query';

// Shares owned and monthly compliance are shown as two independent facts,
// never folded into one number — someone can own many shares and still be
// behind on the current month, or have prepaid months they don't yet own
// the shares for (see PLATFORM_BRAINSTORMING.md's fundamental rule this
// feature is built around).
export function MemberSummaryCard() {
  const myMembershipId = useMyMembershipId();
  const [selected, setSelected] = useState<string | undefined>(undefined);
  const membershipId = selected ?? myMembershipId;

  const { data: membersData } = useMembersQuery();
  // A removed member's history is still real and still worth explaining
  // (see ContributionsService.getMemberSummary, which never filters
  // removedAt) — this picker is for *viewing*, not recording, so it stays
  // open to them, unlike RecordContributionDialog's target picker.
  const viewableMembers = (membersData?.members ?? []).filter(
    (member) => member.status === 'active' || member.status === 'removed',
  );

  const { data: summary, isPending } = useMemberSummaryQuery(membershipId);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle>Contribution status</CardTitle>
            <CardDescription>Shares owned and monthly compliance, tracked independently.</CardDescription>
          </div>
          <Select value={membershipId} onValueChange={setSelected}>
            <SelectTrigger size="sm">
              <SelectValue placeholder="Select a member" />
            </SelectTrigger>
            <SelectContent>
              {viewableMembers.map((member) => (
                <SelectItem key={member.membershipId} value={member.membershipId}>
                  {member.membershipId === myMembershipId
                    ? `${member.email} (you)`
                    : member.status === 'removed'
                      ? `${member.email} (removed)`
                      : member.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {isPending || !summary ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap gap-6">
              <div>
                <Typography variant="small" color="muted">
                  Shares owned
                </Typography>
                <Typography variant="large">{summary.totalShares}</Typography>
              </div>
              <div>
                <Typography variant="small" color="muted">
                  Total contributed
                </Typography>
                <Typography variant="large">{formatAmount(summary.costBasis)}</Typography>
              </div>
              <div>
                <Typography variant="small" color="muted">
                  Value at today&rsquo;s price
                </Typography>
                <Typography variant="large">{formatAmount(summary.currentValue)}</Typography>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {summary.periods.map((period) => (
                <div key={period.period} className="flex flex-wrap items-center justify-between gap-2">
                  <Typography variant="small">{formatPeriodLabel(period.period)}</Typography>
                  <div className="flex items-center gap-2">
                    <Typography variant="small" color="muted">
                      {formatAmount(period.paidAmount)} / {formatAmount(period.dueAmount)}
                    </Typography>
                    <Badge variant={PERIOD_STATUS_BADGE_VARIANT[period.status]}>{PERIOD_STATUS_LABEL[period.status]}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
