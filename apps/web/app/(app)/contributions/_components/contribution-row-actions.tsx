'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { PERMISSIONS, type ContributionListItem } from '@milvaloop/types';

import { Button } from '@milvaloop/ui/button';
import { ConfirmDialog } from '@milvaloop/ui/confirm-dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@milvaloop/ui/tooltip';

import { getErrorMessage } from '@/lib/api/api-fetch';
import { useHasPermission } from '@/lib/auth/use-permissions';
import { formatAmount, formatDate } from '@/lib/contributions/format-period';
import { useApproveContributionMutation } from '@/lib/contributions/use-contribution-mutations';
import { useMyMembershipId } from '@/lib/members/use-my-membership';
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
  const [approveOpen, setApproveOpen] = useState(false);
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
    // ConfirmDialog surfaces whatever this throws verbatim as its own
    // message — an ApiError's own .message is just "METHOD /path failed
    // with 4xx", so the server's actual reason has to be pulled out here
    // before it reaches the dialog.
    try {
      await approve.mutateAsync(contribution.id);
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
    toast.success('Contribution approved.');
  }

  const approveButton = (
    <Button size="sm" onClick={() => setApproveOpen(true)} disabled={isSelfLocked}>
      Approve
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
      <ConfirmDialog
        open={approveOpen}
        onOpenChange={setApproveOpen}
        title="Approve this contribution?"
        description={`${contribution.member.name}'s ${formatAmount(contribution.amount)} contribution paid on ${formatDate(contribution.contributedAt)} will be added to the official ledger. This can't be undone from here.`}
        confirmLabel="Approve"
        pendingLabel="Approving…"
        onConfirm={handleApprove}
      />
      <RejectContributionDialog contributionId={contribution.id} open={rejectOpen} onOpenChange={setRejectOpen} />
    </div>
  );
}
