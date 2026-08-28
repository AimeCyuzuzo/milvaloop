import type { ColumnDef } from '@tanstack/react-table';
import { PERMISSIONS, type MemberListItem } from '@milvaloop/types';

import { Badge } from '@milvaloop/ui/badge';
import { Typography } from '@milvaloop/ui/typography';

import { InviteRowActions } from './invite-row-actions';
import { MemberRowActions } from './member-row-actions';
import { permissionLabel } from './permission-labels';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// memberSince is a plain calendar date ('YYYY-MM-DD'), not a timestamp —
// formatted in UTC so the viewer's own timezone can never shift it back or
// forward a day (unlike formatDate above, which is correct for a real
// moment-in-time timestamp like joinedAt/removedAt/invitedAt).
function formatCalendarDate(date: string) {
  return new Date(date).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export const memberColumns: ColumnDef<MemberListItem>[] = [
  {
    id: 'member',
    accessorFn: (member) => (member.status === 'invited' ? member.email : member.name),
    header: 'Member',
    // An invite has no name yet — nobody has created an account to have
    // one — so it shows only the email it was sent to, same as before. A
    // placeholder member (added by name only, or imported without an
    // email column) has a name but no real login yet — its `email` is a
    // synthetic address nobody can receive mail at, so it's never shown.
    cell: ({ row }) => {
      const member = row.original;
      if (member.status === 'invited') {
        return member.email;
      }
      return (
        <div className="flex flex-col">
          <span>{member.name}</span>
          <Typography variant="small" color="muted">
            {member.hasLogin ? member.email : 'No login yet'}
          </Typography>
        </div>
      );
    },
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
      if (member.status === 'removed') {
        return <Badge variant="outline">Removed</Badge>;
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
    // For an active or removed member this is `memberSince` — the real
    // date they became a member, which an admin can backdate for
    // imported history — not `joinedAt` (when the membership row itself
    // was created in MilvaLoop, which for backfilled history is later
    // than when the person actually joined). An invite instead shows
    // since it was sent, the only date it has.
    accessorFn: (member) => {
      if (member.status === 'active' || member.status === 'removed') return member.memberSince;
      return member.invitedAt;
    },
    header: 'Since',
    cell: ({ row, getValue }) => {
      const member = row.original;
      const value = getValue<string>();
      return member.status === 'active' || member.status === 'removed'
        ? formatCalendarDate(value)
        : formatDate(value);
    },
  },
  {
    id: 'actions',
    enableSorting: false,
    cell: ({ row }) => {
      const member = row.original;
      if (member.status === 'active') {
        return <MemberRowActions member={member} />;
      }
      if (member.status === 'removed') {
        // Nothing can be done on a removed member's behalf any more (see
        // MembersService/ContributionsService's removedAt checks) — no
        // action to offer, not even a disabled one.
        return null;
      }
      return <InviteRowActions invite={member} />;
    },
  },
];
