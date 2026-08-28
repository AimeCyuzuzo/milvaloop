import { EMAIL_COLORS } from './brand.js';
import { EmailLayout } from './layout.js';

export interface MemberRemovedEmailProps {
  memberName: string;
  cooperativeName: string;
  removedByName: string;
}

// No CTA button — unlike an invite, there's no next step to walk them
// toward. They can't get back into this cooperative, and if they belong
// to others, they already know how to reach the app.
function MemberRemovedEmail({ memberName, cooperativeName, removedByName }: MemberRemovedEmailProps) {
  return (
    <EmailLayout previewText={`You've been removed from ${cooperativeName}`}>
      <p style={{ fontSize: 14, color: EMAIL_COLORS.ink, margin: '0 0 8px' }}>Hi {memberName},</p>
      <p style={{ fontSize: 14, color: EMAIL_COLORS.ink, margin: 0 }}>
        <strong>{removedByName}</strong> removed you from <strong>{cooperativeName}</strong> on MilvaLoop. You no
        longer have access to its contributions, members, or activity.
      </p>
    </EmailLayout>
  );
}

export { MemberRemovedEmail };
export default MemberRemovedEmail;
