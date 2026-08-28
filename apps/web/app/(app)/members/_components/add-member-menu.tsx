'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@milvaloop/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@milvaloop/ui/dropdown-menu';

import { AddPlaceholderMemberDialog } from './add-placeholder-member-dialog';
import { InviteMemberDialog } from './invite-member-dialog';

// Three ways to add someone, one menu: an email invite (the common case),
// a name-only placeholder for someone with no email (see
// AddPlaceholderMemberDialog), or a spreadsheet import for a whole member
// list at once. Each dialog is a sibling of the menu, not nested inside a
// menu item — same reasoning as MemberRowActions.
export function AddMemberMenu() {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [placeholderOpen, setPlaceholderOpen] = useState(false);

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
