import { EMAIL_COLORS } from './brand.js';
import { EmailButton, EmailLayout } from './layout.js';

export interface ContributionRecordedEmailProps {
  memberName: string;
  cooperativeName: string;
  periodLabel: string;
  amount: number;
  statusUrl: string;
}

function ContributionRecordedEmail({ memberName, cooperativeName, periodLabel, amount, statusUrl }: ContributionRecordedEmailProps) {
  return (
    <EmailLayout previewText={`Your ${periodLabel} contribution has been recorded`}>
      <p style={{ fontSize: 14, color: EMAIL_COLORS.ink, margin: '0 0 8px' }}>Hi {memberName},</p>
      <p style={{ fontSize: 14, color: EMAIL_COLORS.ink, margin: '0 0 8px' }}>
        Your {periodLabel} contribution of {amount.toLocaleString('en-US')} RWF to {cooperativeName} has been
        recorded.
      </p>
      <EmailButton href={statusUrl}>View your contributions</EmailButton>
    </EmailLayout>
  );
}

export { ContributionRecordedEmail };
export default ContributionRecordedEmail;
