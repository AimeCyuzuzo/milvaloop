import { EMAIL_COLORS } from './brand.js';
import { EmailButton, EmailLayout } from './layout.js';

export interface ContributionApprovedEmailProps {
  memberName: string;
  cooperativeName: string;
  periodLabel: string;
  amount: number;
  statusUrl: string;
}

function ContributionApprovedEmail({ memberName, cooperativeName, periodLabel, amount, statusUrl }: ContributionApprovedEmailProps) {
  return (
    <EmailLayout previewText={`Your ${periodLabel} contribution has been approved`}>
      <p style={{ fontSize: 14, color: EMAIL_COLORS.ink, margin: '0 0 8px' }}>Hi {memberName},</p>
      <p style={{ fontSize: 14, color: EMAIL_COLORS.ink, margin: '0 0 8px' }}>
        Your {periodLabel} contribution of {amount.toLocaleString('en-US')} RWF to {cooperativeName} has been
        approved.
      </p>
      <EmailButton href={statusUrl}>View your contributions</EmailButton>
    </EmailLayout>
  );
}

export { ContributionApprovedEmail };
export default ContributionApprovedEmail;
