import { EMAIL_COLORS } from './brand.js';
import { EmailButton, EmailLayout } from './layout.js';

export interface MonthlyDigestPriceChange {
  amount: number;
}

export interface MonthlyDigestEmailProps {
  cooperativeName: string;
  periodLabel: string;
  totalContributed: number;
  satisfied: number;
  partial: number;
  due: number;
  overdue: number;
  newMemberNames: string[];
  priceChange: MonthlyDigestPriceChange | null;
  statusUrl: string;
}

// Aggregate counts only, deliberately — this goes to every member in the
// cooperative in one identical send, not a personalized report, so it
// never names who is satisfied or overdue (a member's own status is what
// the separate contribution-reminder email, and the app itself, are for).
function MonthlyDigestEmail({
  cooperativeName,
  periodLabel,
  totalContributed,
  satisfied,
  partial,
  due,
  overdue,
  newMemberNames,
  priceChange,
  statusUrl,
}: MonthlyDigestEmailProps) {
  return (
    <EmailLayout previewText={`${cooperativeName}'s summary for ${periodLabel}`}>
      <p style={{ fontSize: 14, color: EMAIL_COLORS.ink, margin: '0 0 8px' }}>
        Here&rsquo;s what happened in {cooperativeName} in {periodLabel}.
      </p>
      <p style={{ fontSize: 14, color: EMAIL_COLORS.ink, margin: '0 0 8px' }}>
        Total contributed: {totalContributed.toLocaleString('en-US')} RWF.
      </p>
      <p style={{ fontSize: 14, color: EMAIL_COLORS.ink, margin: '0 0 8px' }}>
        {satisfied} member{satisfied === 1 ? '' : 's'} fully paid, {partial} partial, {due} due, and{' '}
        {overdue} overdue.
      </p>
      {newMemberNames.length > 0 ? (
        <p style={{ fontSize: 14, color: EMAIL_COLORS.ink, margin: '0 0 8px' }}>
          New member{newMemberNames.length === 1 ? '' : 's'} this month: {newMemberNames.join(', ')}.
        </p>
      ) : null}
      {priceChange ? (
        <p style={{ fontSize: 14, color: EMAIL_COLORS.ink, margin: '0 0 8px' }}>
          The share price changed to {priceChange.amount.toLocaleString('en-US')} RWF this month.
        </p>
      ) : null}
      <EmailButton href={statusUrl}>See the full breakdown</EmailButton>
      <p style={{ fontSize: 12, color: EMAIL_COLORS.muted, margin: 0 }}>
        This is an automated monthly summary sent to every member of {cooperativeName}.
      </p>
    </EmailLayout>
  );
}

export { MonthlyDigestEmail };
export default MonthlyDigestEmail;
