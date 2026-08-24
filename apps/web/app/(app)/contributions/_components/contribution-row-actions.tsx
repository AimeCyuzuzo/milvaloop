'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { PERMISSIONS, type ContributionListItem } from '@milvaloop/types';

import { Button } from '@milvaloop/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@milvaloop/ui/tooltip';

import { getErrorMessage } from '@/lib/api/api-fetch';
import { useHasPermission } from '@/lib/auth/use-permissions';
import { useApproveContributionMutation } from '@/lib/contributions/use-contribution-mutations';
import { useMyMembershipId } from '@/lib/contributions/use-my-membership-id';
import { useMembersQuery } from '@/lib/members/use-members-query';

import { RejectContributionDialog } from './reject-contribution-dialog';

// The recorder of a contribution can't also be its own approver unless
// they're the only membership in the tenant eligible to approve at all
// (see ContributionsService.assertCanApprove) — this is a UI hint of that
// same rule, not the enforcement, which happens on the backend regardless
// of what this button lets someone click.
function useEligibleApproverCount(): number {
  const { data } = useMembersQuery();
  if (!data) {
    return 0;
  }
  return data.members.filter(
    (member) =>
      member.status === 'active' &&
      (member.permissions.includes(PERMISSIONS.CONTRIBUTIONS_APPROVE) || member.permissions.includes(PERMISSIONS.TENANT_ADMIN)),
  ).length;
}

export function ContributionRowActions({ contribution }: { contribution: ContributionListItem }) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const canApprove = useHasPermission(PERMISSIONS.CONTRIBUTIONS_APPROVE);
  const myMembershipId = useMyMembershipId();
  const eligibleApprovers = useEligibleApproverCount();
  const approve = useApproveContributionMutation();

  if (contribution.status !== 'pending' || !canApprove) {
    return null;
  }

  const isSelfLocked = eligibleApprovers > 1 && contribution.recordedBy.membershipId === myMembershipId;

  async function handleApprove() {
    try {
      await approve.mutateAsync(contribution.id);
      toast.success('Contribution approved.');
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  const approveButton = (
    <Button size="sm" onClick={handleApprove} disabled={isSelfLocked || approve.isPending}>
      {approve.isPending ? 'Approving…' : 'Approve'}
    </Button>
  );

  return (
    <div className="flex items-center gap-2">
      {isSelfLocked ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span>{approveButton}</span>
          </TooltipTrigger>
          <TooltipContent>Someone else needs to approve this contribution.</TooltipContent>
        </Tooltip>
      ) : (
        approveButton
      )}
      <Button size="sm" variant="outline" onClick={() => setRejectOpen(true)}>
        Reject
      </Button>
      <RejectContributionDialog contributionId={contribution.id} open={rejectOpen} onOpenChange={setRejectOpen} />
    </div>
  );
}
