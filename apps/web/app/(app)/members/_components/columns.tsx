import type { ColumnDef } from '@tanstack/react-table';
import { PERMISSIONS, type MemberListItem } from '@milvaloop/types';

import { Badge } from '@milvaloop/ui/badge';

import { InviteRowActions } from './invite-row-actions';
import { MemberRowActions } from './member-row-actions';
import { permissionLabel } from './permission-labels';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export const memberColumns: ColumnDef<MemberListItem>[] = [
  {
    accessorKey: 'email',
    header: 'Member',
  },
  {
    id: 'status',
    accessorFn: (member) => member.status,
    header: 'Status',
    cell: ({ row }) => {
      const member = row.original;
      if (member.status === 'active') {
        return (
          <div className="flex flex-wrap gap-1">
            <Badge variant="successSoft">Active</Badge>
            {member.remindersPausedAt ? <Badge variant="outline">Reminders paused</Badge> : null}
          </div>
        );
      }
      const expired = new Date(member.expiresAt) < new Date();
      return expired ? (
        <Badge variant="destructiveSoft">Expired</Badge>
      ) : (
        <Badge variant="warningSoft">Invited</Badge>
      );
    },
  },
  {
    id: 'permissions',
    header: 'Permissions',
    enableSorting: false,
    cell: ({ row }) => {
      const permissions = row.original.permissions;
      if (permissions.length === 0) {
        return <span className="text-muted-foreground text-sm">None</span>;
      }
      return (
        <div className="flex flex-wrap gap-1">
          {permissions.map((permission) => (
            <Badge key={permission} variant={permission === PERMISSIONS.TENANT_ADMIN ? 'default' : 'outline'}>
              {permissionLabel(permission)}
            </Badge>
          ))}
        </div>
      );
    },
  },
  {
    id: 'since',
    accessorFn: (member) => (member.status === 'active' ? member.joinedAt : member.invitedAt),
    header: 'Since',
    cell: ({ getValue }) => formatDate(getValue<string>()),
  },
  {
    id: 'actions',
    enableSorting: false,
    cell: ({ row }) => {
      const member = row.original;
      return member.status === 'active' ? (
        <MemberRowActions member={member} />
      ) : (
        <InviteRowActions invite={member} />
      );
    },
  },
];
