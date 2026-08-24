'use client';

import { toast } from 'sonner';
import type { ActiveMember } from '@milvaloop/types';

import { ConfirmDialog } from '@milvaloop/ui/confirm-dialog';

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
    await remove.mutateAsync(member.membershipId);
    toast.success(`Removed ${member.email}.`);
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Remove ${member.email}?`}
      description="They'll lose access to this cooperative immediately. This can only be undone by inviting them again."
      confirmLabel="Remove member"
      pendingLabel="Removing…"
      variant="destructive"
      onConfirm={handleRemove}
    />
  );
}
