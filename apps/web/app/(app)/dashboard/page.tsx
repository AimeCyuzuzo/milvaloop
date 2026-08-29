'use client';

import { toast } from 'sonner';

import { Alert, AlertDescription, AlertTitle } from '@milvaloop/ui/alert';
import { Button } from '@milvaloop/ui/button';

import { useResendVerificationMutation } from '@/lib/auth/use-auth-mutations';
import { useCurrentSessionQuery } from '@/lib/auth/use-current-session';

import { MoneyOverTimeChart } from './_components/money-over-time-chart';
import { RecentActivityCard } from './_components/recent-activity-card';
import { SummaryCards } from './_components/summary-cards';
import { ThisMonthComplianceBar } from './_components/this-month-compliance-bar';

export default function DashboardPage() {
  const { data: session } = useCurrentSessionQuery();
  const resendVerification = useResendVerificationMutation();

  // AppLayout owns the redirect for a signed-out visitor — this just avoids
  // rendering with no session during that brief window.
  if (!session) {
    return null;
  }

  async function handleResend() {
    await resendVerification.mutateAsync(undefined);
    toast.success('If your email is not yet verified, a new link has been sent.');
  }

  return (
    <div className="flex flex-col gap-6">
      {!session.user.emailVerified ? (
        <Alert>
          <AlertTitle>Verify your email</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <span>Check your inbox for a verification link.</span>
            <div className="w-fit">
              <Button variant="outline" size="sm" onClick={handleResend} disabled={resendVerification.isPending}>
                {resendVerification.isPending ? 'Sending…' : 'Resend verification email'}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      <SummaryCards />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <MoneyOverTimeChart />
        <ThisMonthComplianceBar />
      </div>

      <RecentActivityCard />
    </div>
  );
}
