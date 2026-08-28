'use client';

import { useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import type { ActiveMember } from '@milvaloop/types';
import { PERMISSIONS } from '@milvaloop/types';

import { Button } from '@milvaloop/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@milvaloop/ui/dropdown-menu';

import { useHasPermission } from '@/lib/auth/use-permissions';

import { EditPermissionsSheet } from './edit-permissions-sheet';
import { InviteLoginDialog } from './invite-login-dialog';
import { RemoveMemberDialog } from './remove-member-dialog';

// Dialog/Sheet are rendered as siblings of the DropdownMenu, not nested
// inside a DropdownMenuItem — opening one from inside a menu item fights
// Radix's own focus handling when the menu closes in the same tick.
// Pausing/resuming a member's reminders lives on Settings now, not here —
// one home for that action (see settings/_components/reminder-settings-
// section.tsx); this row still shows the current state via a badge in
// columns.tsx, just doesn't act on it.
export function MemberRowActions({ member }: { member: ActiveMember }) {
  const [editOpen, setEditOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [inviteLoginOpen, setInviteLoginOpen] = useState(false);
  const canEdit = useHasPermission(PERMISSIONS.MEMBERS_EDIT);
  const canRemove = useHasPermission(PERMISSIONS.MEMBERS_REMOVE);
  const canInvite = useHasPermission(PERMISSIONS.MEMBERS_INVITE);
  const canSendLoginInvite = canInvite && !member.hasLogin;

  if (!canEdit && !canRemove && !canSendLoginInvite) {
    return null;
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
          {canSendLoginInvite ? (
            <DropdownMenuItem onSelect={() => setInviteLoginOpen(true)}>Send login invite</DropdownMenuItem>
          ) : null}
          {canEdit ? (
            <DropdownMenuItem onSelect={() => setEditOpen(true)}>Edit permissions</DropdownMenuItem>
          ) : null}
          {canRemove ? (
            <DropdownMenuItem variant="destructive" onSelect={() => setRemoveOpen(true)}>
              Remove
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {canEdit ? <EditPermissionsSheet member={member} open={editOpen} onOpenChange={setEditOpen} /> : null}
      {canRemove ? <RemoveMemberDialog member={member} open={removeOpen} onOpenChange={setRemoveOpen} /> : null}
      {canSendLoginInvite ? (
        <InviteLoginDialog member={member} open={inviteLoginOpen} onOpenChange={setInviteLoginOpen} />
      ) : null}
    </>
  );
}
