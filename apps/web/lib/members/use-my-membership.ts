import type { ActiveMember } from '@milvaloop/types';

import { useCurrentSessionQuery } from '@/lib/auth/use-current-session';

import { useMembersQuery } from './use-members-query';

// There's no membershipId on the session itself (see @milvaloop/types'
// authSessionSchema) — it only ever needed the tenant and permissions —
// so this cross-references the members list the app already fetches for
// the Members page, rather than adding a backend field for one use site.
export function useMyMembership(): ActiveMember | undefined {
  const { data: session } = useCurrentSessionQuery();
  const { data: members } = useMembersQuery();

  const mine = members?.members.find((member) => member.status === 'active' && member.userId === session?.user.id);
  return mine?.status === 'active' ? mine : undefined;
}

export function useMyMembershipId(): string | undefined {
  return useMyMembership()?.membershipId;
}
