'use client';

import { PERMISSIONS } from '@milvaloop/types';

import { DataTable } from '@milvaloop/ui/data-table';
import { Skeleton } from '@milvaloop/ui/skeleton';

import { useHasPermission } from '@/lib/auth/use-permissions';
import { useMembersQuery } from '@/lib/members/use-members-query';

import { AddMemberMenu } from './_components/add-member-menu';
import { memberColumns, renderMemberMobileCard } from './_components/columns';

// The page title/description live in the app shell's top bar (see
// AppLayout + page-headers.ts), not here — this page only owns its content.
export default function MembersPage() {
  const { data, isPending } = useMembersQuery();
  const canInvite = useHasPermission(PERMISSIONS.MEMBERS_INVITE);

  return (
    <div className="flex flex-col gap-6">
      {canInvite ? (
        <div className="flex justify-end">
          <AddMemberMenu />
        </div>
      ) : null}

      {isPending ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        <DataTable
          columns={memberColumns}
          data={data?.members ?? []}
          filterPlaceholder="Search members…"
          mobileCard={renderMemberMobileCard}
        />
      )}
    </div>
  );
}
