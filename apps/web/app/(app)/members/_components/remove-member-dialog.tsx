'use client';

import { toast } from 'sonner';
import type { ActiveMember } from '@milvaloop/types';

import { ConfirmDialog } from '@milvaloop/ui/confirm-dialog';

import { getErrorMessage } from '@/lib/api/api-fetch';
import { useRemoveMemberMutation } from '@/lib/members/use-members-mutations';

export function RemoveMemberDialog({
  member,
  open,
  onOpenChange,
}: {
  member: ActiveMember;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const remove = useRemoveMemberMutation();

  async function handleRemove() {
    // ConfirmDialog surfaces whatever this throws verbatim as its own
    // message — an ApiError's own .message is just "METHOD /path failed
    // with 4xx", so the server's actual reason has to be pulled out here
    // before it reaches the dialog.
    try {
      await remove.mutateAsync(member.membershipId);
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
    toast.success(`Removed ${member.name}.`);
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Remove ${member.name} (${member.email})?`}
      description="They'll lose access to this cooperative immediately. This can only be undone by inviting them again."
      confirmLabel="Remove member"
      pendingLabel="Removing…"
      variant="destructive"
      onConfirm={handleRemove}
    />
  );
}
