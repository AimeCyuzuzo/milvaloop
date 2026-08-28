'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { PERMISSIONS } from '@milvaloop/types';

import { Button } from '@milvaloop/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@milvaloop/ui/card';
import { Skeleton } from '@milvaloop/ui/skeleton';
import { Typography } from '@milvaloop/ui/typography';

import { useCompleteOnboardingMutation } from '@/lib/auth/use-auth-mutations';
import { getErrorMessage } from '@/lib/api/api-fetch';
import { useHasPermission } from '@/lib/auth/use-permissions';
import { useCurrentSessionQuery } from '@/lib/auth/use-current-session';
import { useMembersQuery } from '@/lib/members/use-members-query';

import { AddMemberMenu } from '../members/_components/add-member-menu';
import { SharePriceSection } from '../settings/_components/share-price-section';

// A newly created tenant lands here before it can reach the normal
// dashboard (see AppLayout's onboarding gate) — every section here is
// independently skippable/revisitable, not a locked stepper: a founder
// setting this up on a phone should be able to do it in whatever order
// makes sense to them, and come back to "Finish setup" whenever they're
// ready rather than being forced through a fixed sequence.
export default function OnboardingPage() {
  const router = useRouter();
  const { data: session } = useCurrentSessionQuery();
  const { data: membersData } = useMembersQuery();
  const isAdmin = useHasPermission(PERMISSIONS.TENANT_ADMIN);
  const completeOnboarding = useCompleteOnboardingMutation();

  const memberCount = membersData?.members.filter((member) => member.status !== 'invited').length ?? 0;

  async function handleFinish() {
    try {
      await completeOnboarding.mutateAsync();
      toast.success('Setup complete.');
      router.push('/dashboard');
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  if (!isAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Waiting on setup</CardTitle>
          <CardDescription>
            An admin is still setting up {session?.tenant.name ?? 'this cooperative'}. Check back soon.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <Typography variant="muted">A few things to set up before {session?.tenant.name ?? 'your cooperative'} is ready.</Typography>

      <SharePriceSection />

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>Add everyone in the cooperative — by email, by name only, or all at once from a spreadsheet.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          {membersData ? (
            <Typography variant="small" color="muted">
              {memberCount} {memberCount === 1 ? 'member' : 'members'} so far
            </Typography>
          ) : (
            <Skeleton className="h-5 w-24" />
          )}
          <AddMemberMenu />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contribution history</CardTitle>
          <CardDescription>
            Already have months or years of contributions on paper or in a spreadsheet? Bring them in now — or skip this and
            start fresh from today.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/contributions/import">Import history</Link>
          </Button>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => void handleFinish()} disabled={completeOnboarding.isPending}>
          {completeOnboarding.isPending ? 'Finishing…' : 'Finish setup'}
        </Button>
      </div>
    </div>
  );
}
