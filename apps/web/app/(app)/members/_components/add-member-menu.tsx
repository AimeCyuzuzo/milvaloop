'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { FREE_PLAN_MEMBER_CAP } from '@milvaloop/types';

import { Button } from '@milvaloop/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@milvaloop/ui/dropdown-menu';

import { useCurrentSessionQuery } from '@/lib/auth/use-current-session';
import { useMembersQuery } from '@/lib/members/use-members-query';

import { AddPlaceholderMemberDialog } from './add-placeholder-member-dialog';
import { InviteMemberDialog } from './invite-member-dialog';
import { UpgradeToPremiumDialog } from './upgrade-to-premium-dialog';

// Three ways to add someone, one menu: an email invite (the common case),
// a name-only placeholder for someone with no email (see
// AddPlaceholderMemberDialog), or a spreadsheet import for a whole member
// list at once. Each dialog is a sibling of the menu, not nested inside a
// menu item — same reasoning as MemberRowActions.
export function AddMemberMenu() {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [placeholderOpen, setPlaceholderOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const { data: session } = useCurrentSessionQuery();
  const { data: members } = useMembersQuery();

  // Proactive, not reactive — the point is showing the upgrade prompt
  // instead of the normal menu, not catching a failed request after the
  // fact. The backend enforces the same cap independently either way (see
  // MembersService.assertUnderFreePlanCap) for anyone who gets here some
  // other way.
  const occupiedSlots =
    members?.members.filter((member) => member.status === 'active' || member.status === 'invited').length ?? 0;
  const atFreePlanCap = session?.tenant.plan === 'free' && occupiedSlots >= FREE_PLAN_MEMBER_CAP;

  if (atFreePlanCap) {
    return (
      <>
        <Button onClick={() => setUpgradeOpen(true)}>
          Add member
          <ChevronDown />
        </Button>
        <UpgradeToPremiumDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} />
      </>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button>
            Add member
            <ChevronDown />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setInviteOpen(true)}>Invite by email</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setPlaceholderOpen(true)}>Add without email</DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/members/import">Import from a spreadsheet</Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <InviteMemberDialog open={inviteOpen} onOpenChange={setInviteOpen} />
      <AddPlaceholderMemberDialog open={placeholderOpen} onOpenChange={setPlaceholderOpen} />
    </>
  );
}
