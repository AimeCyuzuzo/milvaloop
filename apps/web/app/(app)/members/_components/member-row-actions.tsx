'use client';

import { useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import type { ActiveMember } from '@milvaloop/types';
import { PERMISSIONS } from '@milvaloop/types';

import { Button } from '@milvaloop/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@milvaloop/ui/dropdown-menu';

import { useHasPermission } from '@/lib/auth/use-permissions';

import { EditPermissionsSheet } from './edit-permissions-sheet';
import { RemoveMemberDialog } from './remove-member-dialog';

// Dialog/Sheet are rendered as siblings of the DropdownMenu, not nested
// inside a DropdownMenuItem — opening one from inside a menu item fights
// Radix's own focus handling when the menu closes in the same tick.
export function MemberRowActions({ member }: { member: ActiveMember }) {
  const [editOpen, setEditOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const canEdit = useHasPermission(PERMISSIONS.MEMBERS_EDIT);
  const canRemove = useHasPermission(PERMISSIONS.MEMBERS_REMOVE);

  if (!canEdit && !canRemove) {
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
    </>
  );
}
