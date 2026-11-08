import { EMAIL_COLORS } from './brand.js';
import { EmailButton, EmailLayout } from './layout.js';

export interface ContributionReminderOutstandingPeriod {
  periodLabel: string;
  dueAmount: number;
  paidAmount: number;
}

export interface ContributionReminderEmailProps {
  memberName: string;
  cooperativeName: string;
  reminderKind: 'due_soon' | 'overdue';
  outstandingPeriods: ContributionReminderOutstandingPeriod[];
  totalRemaining: number;
  statusUrl: string;
}

// One template, not a family of near-duplicate ones per situation — the
// lead sentence is composed from the member's actual outstanding periods
// rather than hardcoded per reminder kind, since a member can be behind on
// several months at once regardless of which trigger fired this send (see
// ContributionReminderService — the email always reflects the member's
// full current picture, not just the newly-crossed period).
function describeOutstanding(
  outstandingPeriods: ContributionReminderOutstandingPeriod[],
  totalRemaining: number,
  reminderKind: 'due_soon' | 'overdue',
): string {
  const [period] = outstandingPeriods;
  if (outstandingPeriods.length === 1 && period) {
    const remaining = period.dueAmount - period.paidAmount;
    if (period.paidAmount > 0) {
      return `You've paid ${period.paidAmount.toLocaleString('en-US')} of ${period.dueAmount.toLocaleString('en-US')} RWF for ${period.periodLabel} — ${remaining.toLocaleString('en-US')} RWF still needed.`;
    }
    const timing = reminderKind === 'due_soon' ? 'due soon' : 'overdue';
    return `Your ${period.periodLabel} contribution of ${period.dueAmount.toLocaleString('en-US')} RWF is ${timing}.`;
  }

  const periodList = outstandingPeriods.map((period) => period.periodLabel).join(', ');
  return `You have ${outstandingPeriods.length} months outstanding (${periodList}), totaling ${totalRemaining.toLocaleString('en-US')} RWF.`;
}

function ContributionReminderEmail({
  memberName,
  cooperativeName,
  reminderKind,
  outstandingPeriods,
  totalRemaining,
  statusUrl,
}: ContributionReminderEmailProps) {
  return (
    <EmailLayout previewText={`A contribution reminder from ${cooperativeName}`}>
      <p style={{ fontSize: 14, color: EMAIL_COLORS.ink, margin: '0 0 8px' }}>Hi {memberName},</p>
      <p style={{ fontSize: 14, color: EMAIL_COLORS.ink, margin: '0 0 8px' }}>
        {describeOutstanding(outstandingPeriods, totalRemaining, reminderKind)}
      </p>
      <p style={{ fontSize: 14, color: EMAIL_COLORS.ink, margin: '0 0 8px' }}>
        You don&rsquo;t have to pay it all at once. Any amount helps — {cooperativeName} applies it starting with
        the oldest month, and the rest can follow later.
      </p>
      <EmailButton href={statusUrl}>View your contributions</EmailButton>
      <p style={{ fontSize: 12, color: EMAIL_COLORS.muted, margin: 0 }}>
        This is an automated reminder. If this doesn&rsquo;t reflect your situation, let an administrator know.
      </p>
    </EmailLayout>
  );
}

export { ContributionReminderEmail };
export default ContributionReminderEmail;
