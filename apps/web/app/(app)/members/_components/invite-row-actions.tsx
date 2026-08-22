'use client';

import { MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { PERMISSIONS, type PendingInvite } from '@milvaloop/types';

import { Button } from '@milvaloop/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@milvaloop/ui/dropdown-menu';

import { getErrorMessage } from '@/lib/api/api-fetch';
import { useHasPermission } from '@/lib/auth/use-permissions';
import { useRevokeInviteMutation } from '@/lib/members/use-members-mutations';

// Revoking is lower-stakes than removing an active member — easily undone
// by inviting the same email again — so this fires directly rather than
// behind a confirmation dialog, same as record-list "undo"-style actions
// elsewhere in the app.
export function InviteRowActions({ invite }: { invite: PendingInvite }) {
  const canRevoke = useHasPermission(PERMISSIONS.MEMBERS_INVITE);
  const revoke = useRevokeInviteMutation();

  if (!canRevoke) {
    return null;
  }

  async function handleRevoke() {
    try {
      await revoke.mutateAsync(invite.inviteId);
      toast.success(`Revoked the invite to ${invite.email}.`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Row actions">
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem variant="destructive" onSelect={handleRevoke} disabled={revoke.isPending}>
          Revoke invite
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
