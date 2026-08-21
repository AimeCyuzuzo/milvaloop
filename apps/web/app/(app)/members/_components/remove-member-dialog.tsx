'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import type { ActiveMember } from '@milvaloop/types';

import { Alert, AlertDescription } from '@milvaloop/ui/alert';
import { Button } from '@milvaloop/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@milvaloop/ui/dialog';

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
  const [error, setError] = useState<string | null>(null);
  const remove = useRemoveMemberMutation();

  async function handleRemove() {
    setError(null);
    try {
      await remove.mutateAsync(member.membershipId);
      toast.success(`Removed ${member.email}.`);
      onOpenChange(false);
    } catch (caught) {
      setError(getErrorMessage(caught));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove {member.email}?</DialogTitle>
          <DialogDescription>
            They&rsquo;ll lose access to this cooperative immediately. This can only be undone by inviting them
            again.
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleRemove} disabled={remove.isPending}>
            {remove.isPending ? 'Removing…' : 'Remove member'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
