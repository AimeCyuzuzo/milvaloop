import { EMAIL_COLORS } from './brand.js';
import { EmailButton, EmailLayout } from './layout.js';

export interface ContributionPendingApprovalEmailProps {
  approverName: string;
  recorderName: string;
  memberName: string;
  cooperativeName: string;
  periodLabel: string;
  amount: number;
  approveUrl: string;
}

// Whoever can approve gets pinged the moment there's something to review —
// this is what lets an approver just check that the money actually arrived
// and click approve, instead of having to remember to go look. The copy
// distinguishes a self-report (a member logging their own payment) from an
// officer recording on someone else's behalf, since the approver's check
// differs slightly (their own memory of receiving it vs. someone else's
// account of it).
function ContributionPendingApprovalEmail({
  approverName,
  recorderName,
  memberName,
  cooperativeName,
  periodLabel,
  amount,
  approveUrl,
}: ContributionPendingApprovalEmailProps) {
  const isSelfReported = recorderName === memberName;
  return (
    <EmailLayout previewText={`A contribution to ${cooperativeName} needs your approval`}>
      <p style={{ fontSize: 14, color: EMAIL_COLORS.ink, margin: '0 0 8px' }}>Hi {approverName},</p>
      <p style={{ fontSize: 14, color: EMAIL_COLORS.ink, margin: '0 0 8px' }}>
        {isSelfReported ? (
          <>
            {memberName} reported a {amount.toLocaleString('en-US')} RWF contribution for {periodLabel}.
          </>
        ) : (
          <>
            {recorderName} recorded a {amount.toLocaleString('en-US')} RWF contribution for {memberName} for{' '}
            {periodLabel}.
          </>
        )}
      </p>
      <p style={{ fontSize: 14, color: EMAIL_COLORS.ink, margin: '0 0 8px' }}>
        Check that the payment came in, then approve or reject it.
      </p>
      <EmailButton href={approveUrl}>Review contribution</EmailButton>
    </EmailLayout>
  );
}

export { ContributionPendingApprovalEmail };
export default ContributionPendingApprovalEmail;
