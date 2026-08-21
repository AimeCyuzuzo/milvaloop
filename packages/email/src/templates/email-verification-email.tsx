import { EMAIL_COLORS } from './brand.js';
import { EmailButton, EmailLayout } from './layout.js';

export interface EmailVerificationEmailProps {
  tenantName: string;
  verifyUrl: string;
}

// Copy matches the inline HTML this replaces in AuthService.sendEmailVerification
// exactly — only the presentation changed.
function EmailVerificationEmail({ tenantName, verifyUrl }: EmailVerificationEmailProps) {
  return (
    <EmailLayout previewText={`Verify your email for ${tenantName}`}>
      <p style={{ fontSize: 14, color: EMAIL_COLORS.ink, margin: '0 0 8px' }}>
        Click the button below to verify your email address for <strong>{tenantName}</strong> on MilvaLoop.
      </p>
      <EmailButton href={verifyUrl}>Verify email</EmailButton>
      <p style={{ fontSize: 12, color: EMAIL_COLORS.muted, margin: 0 }}>
        This link expires in 24 hours. If you didn&rsquo;t create this account, ignore this email.
      </p>
    </EmailLayout>
  );
}

export { EmailVerificationEmail };
export default EmailVerificationEmail;
