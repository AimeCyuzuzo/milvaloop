import { EMAIL_COLORS } from './brand.js';
import { EmailButton, EmailLayout } from './layout.js';

export interface MagicLinkEmailProps {
  loginUrl: string;
}

// Copy matches the inline HTML this replaces in AuthService.requestMagicLink
// exactly — only the presentation changed.
function MagicLinkEmail({ loginUrl }: MagicLinkEmailProps) {
  return (
    <EmailLayout previewText="Sign in to MilvaLoop">
      <p style={{ fontSize: 14, color: EMAIL_COLORS.ink, margin: '0 0 8px' }}>
        Click the button below to sign in to MilvaLoop.
      </p>
      <EmailButton href={loginUrl}>Sign in</EmailButton>
      <p style={{ fontSize: 12, color: EMAIL_COLORS.muted, margin: 0 }}>
        This link expires in 15 minutes and can only be used once. If you didn&rsquo;t request it, ignore this email.
      </p>
    </EmailLayout>
  );
}

export { MagicLinkEmail };
export default MagicLinkEmail;
