import { EMAIL_COLORS } from './brand.js';
import { EmailButton, EmailLayout } from './layout.js';

export interface MemberRemovedEmailProps {
  memberName: string;
  cooperativeName: string;
  removedByEmail: string;
  loginUrl: string;
}

function MemberRemovedEmail({ memberName, cooperativeName, removedByEmail, loginUrl }: MemberRemovedEmailProps) {
  return (
    <EmailLayout previewText={`You've been removed from ${cooperativeName}`}>
      <p style={{ fontSize: 14, color: EMAIL_COLORS.ink, margin: '0 0 8px' }}>Hi {memberName},</p>
      <p style={{ fontSize: 14, color: EMAIL_COLORS.ink, margin: '0 0 8px' }}>
        <strong>{removedByEmail}</strong> removed you from <strong>{cooperativeName}</strong> on MilvaLoop. You no
        longer have access to its contributions, members, or activity.
      </p>
      <p style={{ fontSize: 14, color: EMAIL_COLORS.ink, margin: '0 0 8px' }}>
        Your contribution history there is unchanged and stays on record — this only affects your access.
      </p>
      <EmailButton href={loginUrl}>Sign in to MilvaLoop</EmailButton>
    </EmailLayout>
  );
}

export { MemberRemovedEmail };
export default MemberRemovedEmail;
