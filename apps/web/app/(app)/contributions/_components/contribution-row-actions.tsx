'use client';

import { useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { PERMISSIONS, type ContributionListItem } from '@milvaloop/types';

import { Button } from '@milvaloop/ui/button';
import { ConfirmDialog } from '@milvaloop/ui/confirm-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@milvaloop/ui/dropdown-menu';

import { getErrorMessage } from '@/lib/api/api-fetch';
import { useHasPermission } from '@/lib/auth/use-permissions';
import { formatAmount, formatDate } from '@/lib/contributions/format-period';
import { useApproveContributionMutation } from '@/lib/contributions/use-contribution-mutations';
import { useMyMembershipId } from '@/lib/members/use-my-membership';
import { useMembersQuery } from '@/lib/members/use-members-query';

import { ContributionDetailsDrawer } from './contribution-details-drawer';
import { RejectContributionDialog } from './reject-contribution-dialog';
import { UnapproveContributionDialog } from './unapprove-contribution-dialog';

// The recorder of a contribution can't also be its own approver unless
// they're the only membership in the tenant eligible to approve at all
// (see ContributionsService.assertCanApprove) — this is a UI hint of that
// same rule, not the enforcement, which happens on the backend regardless
// of what this menu lets someone click.
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

// Dialogs are rendered as siblings of the DropdownMenu, not nested inside
// a DropdownMenuItem — opening one from inside a menu item fights Radix's
// own focus handling when the menu closes in the same tick (see
// member-row-actions.tsx's identical pattern for the members table).
export function ContributionRowActions({ contribution }: { contribution: ContributionListItem }) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [unapproveOpen, setUnapproveOpen] = useState(false);
  const canApprove = useHasPermission(PERMISSIONS.CONTRIBUTIONS_APPROVE);
  const myMembershipId = useMyMembershipId();
  const eligibleApprovers = useEligibleApproverCount();
  const approve = useApproveContributionMutation();

  // The same recorder-≠-approver rule governs undoing an approval as
  // making one in the first place (see ContributionsService.assertCanApprove,
  // reused unchanged for unapproveContribution) — the item stays visible
  // but disabled, with its own label saying why, rather than disappearing
  // with no explanation.
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

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Row actions">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setDetailsOpen(true)}>Details</DropdownMenuItem>
          {canApprove && contribution.status === 'pending' ? (
            <>
              <DropdownMenuItem disabled={isSelfLocked} onSelect={() => setApproveOpen(true)}>
                {isSelfLocked ? 'Approve (needs someone else)' : 'Approve'}
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={() => setRejectOpen(true)}>
                Reject
              </DropdownMenuItem>
            </>
          ) : null}
          {canApprove && contribution.status === 'approved' ? (
            <DropdownMenuItem variant="destructive" disabled={isSelfLocked} onSelect={() => setUnapproveOpen(true)}>
              {isSelfLocked ? 'Unapprove (needs someone else)' : 'Unapprove'}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <ContributionDetailsDrawer contributionId={contribution.id} open={detailsOpen} onOpenChange={setDetailsOpen} />
      <ConfirmDialog
        open={approveOpen}
        onOpenChange={setApproveOpen}
        title="Approve this contribution?"
        description={`${contribution.member.name}'s ${formatAmount(contribution.amount)} contribution paid on ${formatDate(contribution.contributedAt)} will be added to the official ledger.`}
        confirmLabel="Approve"
        pendingLabel="Approving…"
        onConfirm={handleApprove}
      />
      <RejectContributionDialog contributionId={contribution.id} open={rejectOpen} onOpenChange={setRejectOpen} />
      <UnapproveContributionDialog contributionId={contribution.id} open={unapproveOpen} onOpenChange={setUnapproveOpen} />
    </>
  );
}
