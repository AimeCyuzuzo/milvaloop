import { EMAIL_COLORS } from './brand.js';
import { EmailButton, EmailLayout } from './layout.js';

export interface PremiumTrialEndingEmailProps {
  cooperativeName: string;
  daysRemaining: number;
  expiresOnLabel: string;
  accountUrl: string;
}

function PremiumTrialEndingEmail({
  cooperativeName,
  daysRemaining,
  expiresOnLabel,
  accountUrl,
}: PremiumTrialEndingEmailProps) {
  return (
    <EmailLayout previewText={`${cooperativeName}'s Premium access ends in ${daysRemaining} days`}>
      <p style={{ fontSize: 14, color: EMAIL_COLORS.ink, margin: '0 0 8px' }}>
        {cooperativeName}&rsquo;s Premium access ends in {daysRemaining} day{daysRemaining === 1 ? '' : 's'}, on{' '}
        {expiresOnLabel}.
      </p>
      <p style={{ fontSize: 14, color: EMAIL_COLORS.ink, margin: '0 0 8px' }}>
        After that, members will be signed out until an administrator renews it — an administrator can still log
        in to view everything, but won&rsquo;t be able to record or approve anything until it&rsquo;s renewed.
      </p>
      <EmailButton href={accountUrl}>View your plan</EmailButton>
      <p style={{ fontSize: 12, color: EMAIL_COLORS.muted, margin: 0 }}>
        This is an automated reminder sent to {cooperativeName}&rsquo;s administrators.
      </p>
    </EmailLayout>
  );
}

export { PremiumTrialEndingEmail };
export default PremiumTrialEndingEmail;
