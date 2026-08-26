import { z } from 'zod';

// A plain calendar-date string, shared by two different uses below: a
// *period* (always the first day of the month it represents — see
// packages/db/src/schema/contribution-allocations.ts) and an ordinary
// *event date* like `contributedAt` (any day at all). Same validation
// either way, so one alias covers both rather than two identical schemas.
export const periodSchema = z.iso.date();

export const contributionStatusSchema = z.enum(['pending', 'approved', 'rejected']);
export type ContributionStatus = z.infer<typeof contributionStatusSchema>;

// A period's status is always computed from the ledger, never stored (see
// PLATFORM_BRAINSTORMING.md's Contribution ≠ Obligation separation) —
// this schema describes the computed shape, not a database column.
export const periodStatusValueSchema = z.enum(['satisfied', 'partial', 'due', 'overdue', 'prepaid']);
export type PeriodStatusValue = z.infer<typeof periodStatusValueSchema>;

export const allocationLineSchema = z.object({
  period: periodSchema,
  amount: z.number().int().positive(),
});
export type AllocationLine = z.infer<typeof allocationLineSchema>;

// Returned by POST /contributions/preview — enough for the UI to show why
// a line is what it is (already partially paid? being paid ahead of time?)
// and to compute the one adjustment it allows (folding a trailing advance
// back into the period before it, or splitting it back out) without a
// second round trip. `alreadyPaidBefore` and `resultingStatus` both reflect
// the period's total after this proposal, not just this line's own amount —
// a line completing an existing partial has a small `amount` but a
// `resultingStatus` of 'satisfied' once `alreadyPaidBefore` is added in.
export const allocationProposalLineSchema = allocationLineSchema.extend({
  sharePriceAmount: z.number().int().positive(),
  alreadyPaidBefore: z.number().int().nonnegative(),
  resultingStatus: z.enum(['satisfied', 'partial']),
});
export type AllocationProposalLine = z.infer<typeof allocationProposalLineSchema>;

// POST /contributions/preview
export const previewAllocationSchema = z.object({
  membershipId: z.uuid(),
  amount: z.number().int().positive(),
});
export type PreviewAllocationInput = z.infer<typeof previewAllocationSchema>;

export const previewAllocationResponseSchema = z.object({
  lines: z.array(allocationProposalLineSchema),
});
export type PreviewAllocationResponse = z.infer<typeof previewAllocationResponseSchema>;

// POST /contributions — `allocations` is always sent explicitly, whether
// it's the preview's proposal returned untouched or a recorder's edited
// version. The backend re-validates the sum rather than trusting either.
export const recordContributionSchema = z.object({
  membershipId: z.uuid(),
  amount: z.number().int().positive(),
  contributedAt: periodSchema,
  note: z.string().max(500).optional(),
  allocations: z.array(allocationLineSchema).min(1),
});
export type RecordContributionInput = z.infer<typeof recordContributionSchema>;

export const contributionIdParamSchema = z.object({ id: z.uuid() });
export type ContributionIdParam = z.infer<typeof contributionIdParamSchema>;

// POST /contributions/:id/reject
export const rejectContributionSchema = z.object({
  reason: z.string().min(1).max(500),
});
export type RejectContributionInput = z.infer<typeof rejectContributionSchema>;

// GET /contributions — status/membershipId are both optional filters; an
// empty query lists everything the caller is allowed to see (transparency:
// every active member of a tenant can see every contribution in it).
export const contributionListQuerySchema = z.object({
  status: contributionStatusSchema.optional(),
  membershipId: z.uuid().optional(),
});
export type ContributionListQuery = z.infer<typeof contributionListQuerySchema>;

export const contributionActorSchema = z.object({
  membershipId: z.uuid(),
  name: z.string(),
  email: z.email(),
});
export type ContributionActor = z.infer<typeof contributionActorSchema>;

export const contributionListItemSchema = z.object({
  id: z.uuid(),
  member: contributionActorSchema,
  amount: z.number().int().positive(),
  contributedAt: periodSchema,
  status: contributionStatusSchema,
  note: z.string().nullable(),
  recordedBy: contributionActorSchema,
  approvedBy: contributionActorSchema.nullable(),
  rejectionReason: z.string().nullable(),
  createdAt: z.iso.datetime(),
});
export type ContributionListItem = z.infer<typeof contributionListItemSchema>;

export const contributionListResponseSchema = z.object({
  contributions: z.array(contributionListItemSchema),
});
export type ContributionListResponse = z.infer<typeof contributionListResponseSchema>;

// GET /contributions/members/:membershipId/summary — the "explain this"
// surface. `costBasis` (money actually paid, ever) is the number the
// frontend treats as the headline figure; `currentValue` (shares × today's
// price) is present but secondary, since it can move on its own whenever
// the cooperative changes its share price, independent of anything this
// member did.
export const periodStatusSchema = z.object({
  period: periodSchema,
  dueAmount: z.number().int().positive(),
  paidAmount: z.number().int().nonnegative(),
  status: periodStatusValueSchema,
});
export type PeriodStatus = z.infer<typeof periodStatusSchema>;

export const memberContributionSummarySchema = z.object({
  membershipId: z.uuid(),
  totalShares: z.number().int().nonnegative(),
  costBasis: z.number().int().nonnegative(),
  currentValue: z.number().int().nonnegative(),
  periods: z.array(periodStatusSchema),
});
export type MemberContributionSummary = z.infer<typeof memberContributionSummarySchema>;

// GET/POST /contributions/settings — the cooperative's share price history.
// `current` is null until an admin completes onboarding (see
// ContributionsService.getSettings); nothing else in the feature is usable
// before that.
export const sharePriceSchema = z.object({
  id: z.uuid(),
  amount: z.number().int().positive(),
  effectiveFrom: periodSchema,
});
export type SharePrice = z.infer<typeof sharePriceSchema>;

export const shareSettingsResponseSchema = z.object({
  current: sharePriceSchema.nullable(),
  history: z.array(sharePriceSchema),
});
export type ShareSettingsResponse = z.infer<typeof shareSettingsResponseSchema>;

export const setSharePriceSchema = z.object({
  amount: z.number().int().positive(),
  effectiveFrom: periodSchema,
});
export type SetSharePriceInput = z.infer<typeof setSharePriceSchema>;

// GET /contributions/compliance-summary — a tenant-wide snapshot of the
// current period only, for the dashboard's "how is this month going"
// card. One count per status a *current* period can actually have —
// 'prepaid' never applies here, since that only describes a period later
// than the current one (see ContributionsService's computeStatus).
export const complianceSummarySchema = z.object({
  period: periodSchema,
  totalMembers: z.number().int().nonnegative(),
  satisfied: z.number().int().nonnegative(),
  partial: z.number().int().nonnegative(),
  due: z.number().int().nonnegative(),
  overdue: z.number().int().nonnegative(),
});
export type ComplianceSummary = z.infer<typeof complianceSummarySchema>;

// GET /contributions/analytics — the tenant-wide report: every number
// derivable from the ledger in one place, so reading it never requires
// adding periods or members up by hand. `periods` covers every period
// since the cooperative's first share price through the current one (not
// just the current month, unlike compliance-summary above, which exists
// only for the dashboard's lightweight card); `members` gives every active
// member's own numbers side by side rather than one at a time.
export const analyticsTotalsSchema = z.object({
  activeMembers: z.number().int().nonnegative(),
  totalSharesOutstanding: z.number().int().nonnegative(),
  totalCostBasis: z.number().int().nonnegative(),
  totalCurrentValue: z.number().int().nonnegative(),
  totalPendingAmount: z.number().int().nonnegative(),
  totalRejectedAmount: z.number().int().nonnegative(),
});
export type AnalyticsTotals = z.infer<typeof analyticsTotalsSchema>;

export const analyticsPeriodRowSchema = z.object({
  period: periodSchema,
  totalMembers: z.number().int().nonnegative(),
  satisfied: z.number().int().nonnegative(),
  partial: z.number().int().nonnegative(),
  due: z.number().int().nonnegative(),
  overdue: z.number().int().nonnegative(),
});
export type AnalyticsPeriodRow = z.infer<typeof analyticsPeriodRowSchema>;

export const analyticsMemberRowSchema = z.object({
  membershipId: z.uuid(),
  name: z.string(),
  email: z.email(),
  totalShares: z.number().int().nonnegative(),
  costBasis: z.number().int().nonnegative(),
  currentValue: z.number().int().nonnegative(),
  currentPeriodStatus: periodStatusValueSchema.nullable(),
});
export type AnalyticsMemberRow = z.infer<typeof analyticsMemberRowSchema>;

export const analyticsResponseSchema = z.object({
  asOfPeriod: periodSchema,
  totals: analyticsTotalsSchema,
  periods: z.array(analyticsPeriodRowSchema),
  members: z.array(analyticsMemberRowSchema),
});
export type AnalyticsResponse = z.infer<typeof analyticsResponseSchema>;
