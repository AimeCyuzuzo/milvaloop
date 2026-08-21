import { EMAIL_COLORS } from './brand.js';
import { EmailButton, EmailLayout } from './layout.js';

export interface PasswordResetEmailProps {
  resetUrl: string;
}

// Copy matches the inline HTML this replaces in AuthService.requestPasswordReset
// exactly — only the presentation changed.
function PasswordResetEmail({ resetUrl }: PasswordResetEmailProps) {
  return (
    <EmailLayout previewText="Reset your MilvaLoop password">
      <p style={{ fontSize: 14, color: EMAIL_COLORS.ink, margin: '0 0 8px' }}>
        Click the button below to set a new password for your MilvaLoop account.
      </p>
      <EmailButton href={resetUrl}>Reset password</EmailButton>
      <p style={{ fontSize: 12, color: EMAIL_COLORS.muted, margin: 0 }}>
        This link expires in 1 hour and can only be used once. If you didn&rsquo;t request it, ignore this email —
        your password hasn&rsquo;t been changed.
      </p>
    </EmailLayout>
  );
}

export { PasswordResetEmail };
export default PasswordResetEmail;
