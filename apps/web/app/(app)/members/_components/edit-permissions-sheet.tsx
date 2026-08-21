'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { GRANTABLE_PERMISSIONS, type ActiveMember, type GrantablePermission } from '@milvaloop/types';

import { Alert, AlertDescription } from '@milvaloop/ui/alert';
import { Button } from '@milvaloop/ui/button';
import { Checkbox } from '@milvaloop/ui/checkbox';
import { Label } from '@milvaloop/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@milvaloop/ui/sheet';

import { getErrorMessage } from '@/lib/api/api-fetch';
import { useUpdateMemberPermissionsMutation } from '@/lib/members/use-members-mutations';

import { PERMISSION_LABELS } from './permission-labels';

export function EditPermissionsSheet({
  member,
  open,
  onOpenChange,
}: {
  member: ActiveMember;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [permissions, setPermissions] = useState<GrantablePermission[]>([]);
  const [error, setError] = useState<string | null>(null);
  const update = useUpdateMemberPermissionsMutation();

  // Reset to this member's current (non-admin) permissions each time the
  // sheet opens — admin status itself is never shown or editable here (see
  // MembersService.updatePermissions), so it's simply left out of the list.
  useEffect(() => {
    if (open) {
      setPermissions(
        member.permissions.filter((p): p is GrantablePermission =>
          (GRANTABLE_PERMISSIONS as readonly string[]).includes(p),
        ),
      );
      setError(null);
    }
  }, [open, member.permissions]);

  async function handleSave() {
    setError(null);
    try {
      await update.mutateAsync({ membershipId: member.membershipId, permissions });
      toast.success(`Updated permissions for ${member.email}.`);
      onOpenChange(false);
    } catch (caught) {
      setError(getErrorMessage(caught));
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Edit permissions</SheetTitle>
          <SheetDescription>{member.email}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4">
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {GRANTABLE_PERMISSIONS.map((permission) => (
            <div key={permission} className="flex items-center gap-2">
              <Checkbox
                id={`edit-${permission}`}
                checked={permissions.includes(permission)}
                onCheckedChange={(checked) => {
                  setPermissions((current) =>
                    checked ? [...current, permission] : current.filter((value) => value !== permission),
                  );
                }}
              />
              <Label htmlFor={`edit-${permission}`}>{PERMISSION_LABELS[permission]}</Label>
            </div>
          ))}
        </div>
        <SheetFooter>
          <Button onClick={handleSave} disabled={update.isPending}>
            {update.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
