'use client';

import { useState } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@milvaloop/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@milvaloop/ui/select';
import { Skeleton } from '@milvaloop/ui/skeleton';
import { Typography } from '@milvaloop/ui/typography';

import { formatAmount, formatPeriodLabel } from '@/lib/contributions/format-period';
import { useMemberSummaryQuery } from '@/lib/contributions/use-member-summary-query';
import { useMyMembershipId } from '@/lib/members/use-my-membership';
import { useMembersQuery } from '@/lib/members/use-members-query';

import { PeriodHistory } from './period-history';

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
                    ? `${member.name} (you)`
                    : member.status === 'removed'
                      ? `${member.name} (removed)`
                      : member.name}
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
            </div>

            <PeriodHistory
              rows={summary.periods.map((period) => ({
                key: period.period,
                label: formatPeriodLabel(period.period),
                period,
              }))}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
