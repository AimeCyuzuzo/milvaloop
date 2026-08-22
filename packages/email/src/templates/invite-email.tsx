import { EMAIL_COLORS } from './brand.js';
import { EmailButton, EmailLayout } from './layout.js';

export interface InviteEmailProps {
  tenantName: string;
  invitedByEmail: string;
  acceptUrl: string;
}

function InviteEmail({ tenantName, invitedByEmail, acceptUrl }: InviteEmailProps) {
  return (
    <EmailLayout previewText={`You've been invited to join ${tenantName} on MilvaLoop`}>
      <p style={{ fontSize: 14, color: EMAIL_COLORS.ink, margin: '0 0 8px' }}>
        <strong>{invitedByEmail}</strong> has invited you to join <strong>{tenantName}</strong> on MilvaLoop.
      </p>
      <EmailButton href={acceptUrl}>Accept invite</EmailButton>
      <p style={{ fontSize: 12, color: EMAIL_COLORS.muted, margin: 0 }}>
        This link expires in 7 days and can only be used once. If you weren&rsquo;t expecting this, ignore this
        email.
      </p>
    </EmailLayout>
  );
}

export { InviteEmail };
export default InviteEmail;
