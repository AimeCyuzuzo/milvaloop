import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, isNull, schema, type Database } from '@milvaloop/db';
import {
  ContributionApprovedEmail,
  ContributionPendingApprovalEmail,
  renderEmail,
  type Mailer,
} from '@milvaloop/email';
import {
  PERMISSIONS,
  type AnalyticsMemberRow,
  type AnalyticsPeriodRow,
  type AnalyticsResponse,
  type ComplianceSummary,
  type ContributionListItem,
  type ContributionListQuery,
  type ContributionListResponse,
  type MemberContributionSummary,
  type PeriodStatus,
  type PeriodStatusValue,
  type PreviewAllocationInput,
  type PreviewAllocationResponse,
  type RecordContributionInput,
  type SetSharePriceInput,
  type ShareSettingsResponse,
  type SharePrice,
} from '@milvaloop/types';

import { AuditLogService } from '../audit/audit-log.service';
import { isUniqueViolation } from '../common/db-errors';
import { env } from '../config/env';
import { DATABASE_CONNECTION } from '../db/db.module';
import type { Transaction } from '../db/types';
import { MAILER } from '../email/mailer.module';
import {
  buildExportFilename,
  ExportService,
  type ExportSheet,
} from '../export/export.service';
import { formatPeriodLabel, truncateToMonth } from './contributions-dates';
import {
  computeWaterfallAllocations,
  nextPeriod,
  type OutstandingPeriod,
} from './contributions-waterfall';

const {
  contributionAllocations,
  contributions,
  memberships,
  sharePrices,
  tenants,
  users,
} = schema;

interface SharePriceRow {
  id: string;
  amount: number;
  effectiveFrom: string;
}

interface ComputedPeriod {
  period: string;
  dueAmount: number;
  paidAmount: number;
  status: PeriodStatusValue;
}

// How far past the current month getMemberSummary's display window
// extends when nothing beyond it has actually been touched, so a member
// with nothing prepaid still sees a little of what's coming, not a view
// that stops dead at "now".
const SUMMARY_LOOKAHEAD_MONTHS = 2;

// `prices` sorted oldest-first; a period's price is whichever one was
// effective on or before it — a share bought to satisfy an old month is
// priced at what a share cost *then* (see share-prices.ts's own comment).
function priceAsOf(
  prices: SharePriceRow[],
  period: string,
): SharePriceRow | undefined {
  let result: SharePriceRow | undefined;
  for (const price of prices) {
    if (price.effectiveFrom <= period) {
      result = price;
    } else {
      break;
    }
  }
  return result;
}

// A past period left unsatisfied is always 'overdue', whether it received
// a partial payment or nothing at all — 'partial' only describes a
// current-or-future period still within its own window. Past-due lateness
// is the more urgent fact once the window has closed.
function computeStatus(
  period: string,
  currentPeriod: string,
  dueAmount: number,
  paidAmount: number,
): PeriodStatusValue {
  if (paidAmount >= dueAmount) {
    return period > currentPeriod ? 'prepaid' : 'satisfied';
  }
  if (period < currentPeriod) {
    return 'overdue';
  }
  return paidAmount > 0 ? 'partial' : 'due';
}

@Injectable()
export class ContributionsService {
  private readonly logger = new Logger(ContributionsService.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    @Inject(MAILER) private readonly mailer: Mailer,
    private readonly auditLog: AuditLogService,
    private readonly exportService: ExportService,
  ) {}

  async getSettings(tenantId: string): Promise<ShareSettingsResponse> {
    const rows = await this.loadSharePrices(this.db, tenantId);
    const history: SharePrice[] = rows.map((row) => ({
      id: row.id,
      amount: row.amount,
      effectiveFrom: row.effectiveFrom,
    }));
    const current = history.length > 0 ? history[history.length - 1] : null;
    return { current: current ?? null, history };
  }

  async setSharePrice(
    tenantId: string,
    actorUserId: string,
    input: SetSharePriceInput,
  ): Promise<SharePrice> {
    // Normalized to the first of its month — every period lookup in this
    // service compares against a period's own first-of-month string, so an
    // effectiveFrom left at day-level precision (e.g. set up mid-month)
    // would fail to cover the very period it was meant to price. Periods
    // are month-granular everywhere in this feature; effectiveFrom must be
    // too, regardless of what exact day the caller sent.
    const effectiveFrom = `${input.effectiveFrom.slice(0, 7)}-01`;

    try {
      return await this.db.transaction(async (tx) => {
        const [row] = await tx
          .insert(sharePrices)
          .values({
            tenantId,
            amount: input.amount,
            effectiveFrom,
          })
          .returning();

        await this.auditLog.record(tx, {
          tenantId,
          actorUserId,
          action: 'contribution.share_price_set',
          entityType: 'share_price',
          entityId: row.id,
          metadata: {
            amount: input.amount,
            effectiveFrom,
          },
        });

        return {
          id: row.id,
          amount: row.amount,
          effectiveFrom: row.effectiveFrom,
        };
      });
    } catch (error) {
      if (
        isUniqueViolation(error, 'share_prices_tenant_id_effective_from_unique')
      ) {
        throw new ConflictException(
          'A share price is already set for this effective date',
        );
      }
      throw error;
    }
  }

  async previewAllocation(
    tenantId: string,
    callerUserId: string,
    callerPermissions: string[],
    input: PreviewAllocationInput,
  ): Promise<PreviewAllocationResponse> {
    const callerMembershipId = await this.resolveActiveMembershipId(
      this.db,
      tenantId,
      callerUserId,
    );
    this.assertCanRecordFor(
      callerMembershipId,
      callerPermissions,
      input.membershipId,
    );
    await this.assertMembershipActive(this.db, tenantId, input.membershipId);

    const { periods, sharePriceRows } = await this.loadOutstandingPeriods(
      tenantId,
      input.membershipId,
    );
    const outstanding: OutstandingPeriod[] = periods.map((period) => ({
      period: period.period,
      dueAmount: period.dueAmount,
      alreadyPaid: period.paidAmount,
    }));
    const latestPrice = sharePriceRows[sharePriceRows.length - 1];
    if (!latestPrice) {
      throw new BadRequestException(
        'Contributions have not been set up for this cooperative yet',
      );
    }

    const lines = computeWaterfallAllocations(
      outstanding,
      input.amount,
      latestPrice.amount,
    );
    const alreadyPaidByPeriod = new Map(
      periods.map((period) => [period.period, period.paidAmount]),
    );
    return {
      // `resultingStatus` reflects the period's total after this proposal,
      // not just this line's own amount — a line completing an existing
      // partial has a small `amount` but is genuinely 'satisfied' once
      // what was already there is added back in.
      lines: lines.map((line) => {
        const dueAmount =
          priceAsOf(sharePriceRows, line.period)?.amount ?? latestPrice.amount;
        const alreadyPaidBefore = alreadyPaidByPeriod.get(line.period) ?? 0;
        return {
          period: line.period,
          amount: line.amount,
          sharePriceAmount: dueAmount,
          alreadyPaidBefore,
          resultingStatus:
            alreadyPaidBefore + line.amount >= dueAmount
              ? 'satisfied'
              : 'partial',
        };
      }),
    };
  }

  async recordContribution(
    tenantId: string,
    recordedByUserId: string,
    callerPermissions: string[],
    input: RecordContributionInput,
  ): Promise<void> {
    const allocationSum = input.allocations.reduce(
      (total, line) => total + line.amount,
      0,
    );
    if (allocationSum !== input.amount) {
      throw new BadRequestException(
        'Allocation amounts must sum to the contribution amount',
      );
    }

    const contribution = await this.db.transaction(async (tx) => {
      const recordedByMembershipId = await this.resolveActiveMembershipId(
        tx,
        tenantId,
        recordedByUserId,
      );
      this.assertCanRecordFor(
        recordedByMembershipId,
        callerPermissions,
        input.membershipId,
      );

      const [member] = await tx
        .select({ id: memberships.id, name: users.name, email: users.email })
        .from(memberships)
        .innerJoin(users, eq(memberships.userId, users.id))
        .where(
          and(
            eq(memberships.id, input.membershipId),
            eq(memberships.tenantId, tenantId),
            isNull(memberships.removedAt),
          ),
        )
        .limit(1);
      if (!member) {
        throw new NotFoundException('No active member found');
      }

      const sharePriceRows = await this.loadSharePrices(tx, tenantId);
      if (sharePriceRows.length === 0) {
        throw new BadRequestException(
          'Contributions have not been set up for this cooperative yet',
        );
      }

      const [contribution] = await tx
        .insert(contributions)
        .values({
          tenantId,
          membershipId: input.membershipId,
          amount: input.amount,
          contributedAt: new Date(input.contributedAt),
          recordedByMembershipId,
          note: input.note,
        })
        .returning();

      for (const line of input.allocations) {
        const sharePriceId = await this.resolveSharePriceIdForPeriod(
          tx,
          input.membershipId,
          line.period,
          sharePriceRows,
        );
        await tx.insert(contributionAllocations).values({
          tenantId,
          contributionId: contribution.id,
          period: line.period,
          amount: line.amount,
          sharePriceId,
        });
      }

      await this.auditLog.record(tx, {
        tenantId,
        actorUserId: recordedByUserId,
        action: 'contribution.recorded',
        entityType: 'contribution',
        entityId: contribution.id,
        metadata: {
          membershipId: input.membershipId,
          name: member.name,
          email: member.email,
          amount: input.amount,
          allocations: input.allocations,
        },
      });

      return contribution;
    });

    await this.sendPendingApprovalEmail(tenantId, contribution);
  }

  async approveContribution(
    tenantId: string,
    approverUserId: string,
    contributionId: string,
  ): Promise<void> {
    const approved = await this.db.transaction(async (tx) => {
      const approverMembershipId = await this.resolveActiveMembershipId(
        tx,
        tenantId,
        approverUserId,
      );
      const contribution = await this.loadPendingContribution(
        tx,
        tenantId,
        contributionId,
      );
      await this.assertCanApprove(
        tx,
        tenantId,
        approverMembershipId,
        contribution.recordedByMembershipId,
      );

      await tx
        .update(contributions)
        .set({
          status: 'approved',
          approvedByMembershipId: approverMembershipId,
          approvedAt: new Date(),
        })
        .where(eq(contributions.id, contributionId));

      const approvedMember = await this.loadMembershipContact(
        tx,
        contribution.membershipId,
      );
      await this.auditLog.record(tx, {
        tenantId,
        actorUserId: approverUserId,
        action: 'contribution.approved',
        entityType: 'contribution',
        entityId: contributionId,
        metadata: {
          membershipId: contribution.membershipId,
          name: approvedMember?.name,
          email: approvedMember?.email,
          amount: contribution.amount,
        },
      });

      return contribution;
    });

    await this.sendApprovedEmail(tenantId, approved);
  }

  async rejectContribution(
    tenantId: string,
    approverUserId: string,
    contributionId: string,
    reason: string,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      const approverMembershipId = await this.resolveActiveMembershipId(
        tx,
        tenantId,
        approverUserId,
      );
      const contribution = await this.loadPendingContribution(
        tx,
        tenantId,
        contributionId,
      );
      await this.assertCanApprove(
        tx,
        tenantId,
        approverMembershipId,
        contribution.recordedByMembershipId,
      );

      await tx
        .update(contributions)
        .set({
          status: 'rejected',
          approvedByMembershipId: approverMembershipId,
          approvedAt: new Date(),
          rejectionReason: reason,
        })
        .where(eq(contributions.id, contributionId));

      const rejectedMember = await this.loadMembershipContact(
        tx,
        contribution.membershipId,
      );
      await this.auditLog.record(tx, {
        tenantId,
        actorUserId: approverUserId,
        action: 'contribution.rejected',
        entityType: 'contribution',
        entityId: contributionId,
        metadata: {
          membershipId: contribution.membershipId,
          name: rejectedMember?.name,
          email: rejectedMember?.email,
          amount: contribution.amount,
          reason,
        },
      });
    });
  }

  async getMemberSummary(
    tenantId: string,
    membershipId: string,
  ): Promise<MemberContributionSummary> {
    const sharePriceRows = await this.loadSharePrices(this.db, tenantId);
    if (sharePriceRows.length === 0) {
      throw new BadRequestException(
        'Contributions have not been set up for this cooperative yet',
      );
    }

    return this.computeMemberSnapshot(tenantId, membershipId, sharePriceRows);
  }

  // The one place that computes a member's shares/cost-basis/period
  // history — used both for that member's own "explain this" page
  // (getMemberSummary) and, looped over every active membership, for the
  // tenant-wide analytics report below. `sharePriceRows` is loaded once by
  // the caller and passed in rather than reloaded per member.
  private async computeMemberSnapshot(
    tenantId: string,
    membershipId: string,
    sharePriceRows: SharePriceRow[],
  ): Promise<MemberContributionSummary> {
    const current = this.currentPeriod();
    let lookaheadPeriod = current;
    for (let i = 0; i < SUMMARY_LOOKAHEAD_MONTHS; i += 1) {
      lookaheadPeriod = nextPeriod(lookaheadPeriod);
    }
    const latestTouched = await this.loadLatestTouchedPeriod(
      membershipId,
      current,
    );
    const throughPeriod =
      latestTouched > lookaheadPeriod ? latestTouched : lookaheadPeriod;

    const periods = await this.loadPeriodsThrough(
      tenantId,
      membershipId,
      throughPeriod,
      sharePriceRows,
    );
    const costBasis = await this.sumApprovedContributions(membershipId);
    const latestPrice = sharePriceRows[sharePriceRows.length - 1];
    const totalShares = this.sumSharesOwned(periods);
    const periodStatuses: PeriodStatus[] = periods.map((period) => ({
      period: period.period,
      dueAmount: period.dueAmount,
      paidAmount: period.paidAmount,
      status: period.status,
    }));

    return {
      membershipId,
      totalShares,
      costBasis,
      currentValue: latestPrice ? totalShares * latestPrice.amount : 0,
      periods: periodStatuses,
    };
  }

  // A share is owned once a period is paid in full, at that period's own
  // pinned price — never re-valued at today's price (see
  // contribution-allocations.ts). Shared by every place that reports a
  // member's share count so this math exists exactly once.
  private sumSharesOwned(periods: ComputedPeriod[]): number {
    return periods.reduce(
      (total, period) =>
        total + Math.floor(period.paidAmount / period.dueAmount),
      0,
    );
  }

  // GET /contributions/analytics — the tenant-wide "everything in one
  // place" report: cooperative totals, the full period-by-period
  // compliance history (every period since the first share price, not
  // just the current month — unlike compliance-summary above, which stays
  // narrow on purpose for the dashboard's lightweight card), and every
  // active member's own numbers side by side. Nothing here is gated beyond
  // a valid session — it aggregates numbers that are already individually
  // visible to any member (see getMemberSummary), just without making
  // anyone add them up by hand.
  async getAnalytics(tenantId: string): Promise<AnalyticsResponse> {
    const sharePriceRows = await this.loadSharePrices(this.db, tenantId);
    if (sharePriceRows.length === 0) {
      throw new BadRequestException(
        'Contributions have not been set up for this cooperative yet',
      );
    }

    const current = this.currentPeriod();
    const activeMemberships = await this.db
      .select({ id: memberships.id, name: users.name, email: users.email })
      .from(memberships)
      .innerJoin(users, eq(memberships.userId, users.id))
      .where(
        and(eq(memberships.tenantId, tenantId), isNull(memberships.removedAt)),
      );

    const snapshots = await Promise.all(
      activeMemberships.map((membership) =>
        this.computeMemberSnapshot(tenantId, membership.id, sharePriceRows),
      ),
    );

    const periodCounts = new Map<
      string,
      {
        totalMembers: number;
        satisfied: number;
        partial: number;
        due: number;
        overdue: number;
      }
    >();
    for (const snapshot of snapshots) {
      for (const period of snapshot.periods) {
        // Only periods through the current one — a period beyond it is a
        // member's own prepaid lookahead (see computeMemberSnapshot), not
        // a fact about the cooperative's compliance history yet.
        if (period.period > current || period.status === 'prepaid') {
          continue;
        }
        const bucket = periodCounts.get(period.period) ?? {
          totalMembers: 0,
          satisfied: 0,
          partial: 0,
          due: 0,
          overdue: 0,
        };
        bucket.totalMembers += 1;
        bucket[period.status] += 1;
        periodCounts.set(period.period, bucket);
      }
    }
    const periods: AnalyticsPeriodRow[] = Array.from(periodCounts.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, counts]) => ({ period, ...counts }));

    const { pending: totalPendingAmount, rejected: totalRejectedAmount } =
      await this.sumContributionsByStatus(tenantId);

    const membersById = new Map(
      activeMemberships.map((membership) => [membership.id, membership]),
    );
    const members: AnalyticsMemberRow[] = snapshots.map((snapshot) => ({
      membershipId: snapshot.membershipId,
      name: membersById.get(snapshot.membershipId)?.name ?? '',
      email: membersById.get(snapshot.membershipId)?.email ?? '',
      totalShares: snapshot.totalShares,
      costBasis: snapshot.costBasis,
      currentValue: snapshot.currentValue,
      currentPeriodStatus:
        snapshot.periods.find((period) => period.period === current)?.status ??
        null,
    }));

    return {
      asOfPeriod: current,
      totals: {
        activeMembers: activeMemberships.length,
        totalSharesOutstanding: members.reduce(
          (total, member) => total + member.totalShares,
          0,
        ),
        totalCostBasis: members.reduce(
          (total, member) => total + member.costBasis,
          0,
        ),
        totalCurrentValue: members.reduce(
          (total, member) => total + member.currentValue,
          0,
        ),
        totalPendingAmount,
        totalRejectedAmount,
      },
      periods,
      members,
    };
  }

  // GET /contributions/analytics/export — the same report as getAnalytics,
  // as a workbook someone can hand to a treasurer who isn't in the app:
  // one sheet per shape of data (totals, period history, per-member),
  // rather than flattening everything into a single confusing sheet.
  async exportAnalytics(
    tenantId: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const analytics = await this.getAnalytics(tenantId);

    const overviewSheet: ExportSheet = {
      name: 'Overview',
      columns: [
        { header: 'Metric', key: 'metric', width: 32 },
        { header: 'Value', key: 'value' },
      ],
      rows: [
        { metric: 'As of period', value: analytics.asOfPeriod },
        { metric: 'Active members', value: analytics.totals.activeMembers },
        {
          metric: 'Total shares outstanding',
          value: analytics.totals.totalSharesOutstanding,
        },
        {
          metric: 'Total contributed (cost basis, RWF)',
          value: analytics.totals.totalCostBasis,
        },
        {
          metric: "Total value at today's price (RWF)",
          value: analytics.totals.totalCurrentValue,
        },
        {
          metric: 'Pending approval (RWF)',
          value: analytics.totals.totalPendingAmount,
        },
        {
          metric: 'Rejected, all-time (RWF)',
          value: analytics.totals.totalRejectedAmount,
        },
      ],
    };
    const periodsSheet: ExportSheet = {
      name: 'By period',
      columns: [
        { header: 'Period', key: 'period' },
        { header: 'Members', key: 'totalMembers' },
        { header: 'Satisfied', key: 'satisfied' },
        { header: 'Partial', key: 'partial' },
        { header: 'Due', key: 'due' },
        { header: 'Overdue', key: 'overdue' },
      ],
      rows: analytics.periods.map((period) => ({ ...period })),
    };
    const membersSheet: ExportSheet = {
      name: 'By member',
      columns: [
        { header: 'Member', key: 'name', width: 24 },
        { header: 'Email', key: 'email', width: 28 },
        { header: 'Shares owned', key: 'totalShares' },
        { header: 'Total contributed (RWF)', key: 'costBasis' },
        { header: "Value at today's price (RWF)", key: 'currentValue' },
        { header: 'Current period status', key: 'currentPeriodStatus' },
      ],
      rows: analytics.members.map((member) => ({
        name: member.name,
        email: member.email,
        totalShares: member.totalShares,
        costBasis: member.costBasis,
        currentValue: member.currentValue,
        currentPeriodStatus: member.currentPeriodStatus,
      })),
    };

    const buffer = await this.exportService.buildWorkbook([
      overviewSheet,
      periodsSheet,
      membersSheet,
    ]);
    const tenantSlug = await this.loadTenantSlug(tenantId);
    const filename = buildExportFilename([
      tenantSlug,
      'contributions',
      'analytics',
      analytics.asOfPeriod,
    ]);
    return { buffer, filename };
  }

  private async loadTenantSlug(tenantId: string): Promise<string> {
    const [tenant] = await this.db
      .select({ slug: tenants.slug })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);
    return tenant?.slug ?? tenantId;
  }

  private async sumContributionsByStatus(
    tenantId: string,
  ): Promise<Record<'pending' | 'approved' | 'rejected', number>> {
    const rows = await this.db
      .select({ status: contributions.status, amount: contributions.amount })
      .from(contributions)
      .where(eq(contributions.tenantId, tenantId));

    const totals = { pending: 0, approved: 0, rejected: 0 };
    for (const row of rows) {
      totals[row.status] += row.amount;
    }
    return totals;
  }

  // GET /contributions/compliance-summary — the dashboard's "how is this
  // month going" card: a tenant-wide count of the current period's status
  // across every active member, not any one member's own history.
  async getTenantComplianceSummary(
    tenantId: string,
  ): Promise<ComplianceSummary> {
    const sharePriceRows = await this.loadSharePrices(this.db, tenantId);
    if (sharePriceRows.length === 0) {
      throw new BadRequestException(
        'Contributions have not been set up for this cooperative yet',
      );
    }

    const current = this.currentPeriod();
    const activeMemberships = await this.db
      .select({ id: memberships.id })
      .from(memberships)
      .where(
        and(eq(memberships.tenantId, tenantId), isNull(memberships.removedAt)),
      );

    const counts: Record<PeriodStatusValue, number> = {
      satisfied: 0,
      partial: 0,
      due: 0,
      overdue: 0,
      prepaid: 0,
    };
    for (const { id: membershipId } of activeMemberships) {
      const periods = await this.loadPeriodsThrough(
        tenantId,
        membershipId,
        current,
        sharePriceRows,
      );
      const currentPeriodStatus = periods[periods.length - 1];
      if (currentPeriodStatus) {
        counts[currentPeriodStatus.status] += 1;
      }
    }

    return {
      period: current,
      totalMembers: activeMemberships.length,
      satisfied: counts.satisfied,
      partial: counts.partial,
      due: counts.due,
      overdue: counts.overdue,
    };
  }

  async listContributions(
    tenantId: string,
    filters: ContributionListQuery,
  ): Promise<ContributionListResponse> {
    const conditions = [eq(contributions.tenantId, tenantId)];
    if (filters.status) {
      conditions.push(eq(contributions.status, filters.status));
    }
    if (filters.membershipId) {
      conditions.push(eq(contributions.membershipId, filters.membershipId));
    }

    const rows = await this.db
      .select({
        id: contributions.id,
        amount: contributions.amount,
        contributedAt: contributions.contributedAt,
        status: contributions.status,
        note: contributions.note,
        rejectionReason: contributions.rejectionReason,
        createdAt: contributions.createdAt,
        memberMembershipId: contributions.membershipId,
        memberName: users.name,
        memberEmail: users.email,
        recordedByMembershipId: contributions.recordedByMembershipId,
        approvedByMembershipId: contributions.approvedByMembershipId,
      })
      .from(contributions)
      .innerJoin(memberships, eq(contributions.membershipId, memberships.id))
      .innerJoin(users, eq(memberships.userId, users.id))
      .where(and(...conditions));

    const contactByMembershipId = await this.loadMembershipContacts(tenantId);

    const items: ContributionListItem[] = rows.map((row) => ({
      id: row.id,
      member: {
        membershipId: row.memberMembershipId,
        name: row.memberName,
        email: row.memberEmail,
      },
      amount: row.amount,
      contributedAt: row.contributedAt.toISOString().slice(0, 10),
      status: row.status as ContributionListItem['status'],
      note: row.note,
      recordedBy: {
        membershipId: row.recordedByMembershipId,
        name: contactByMembershipId.get(row.recordedByMembershipId)?.name ?? '',
        email:
          contactByMembershipId.get(row.recordedByMembershipId)?.email ?? '',
      },
      approvedBy: row.approvedByMembershipId
        ? {
            membershipId: row.approvedByMembershipId,
            name:
              contactByMembershipId.get(row.approvedByMembershipId)?.name ?? '',
            email:
              contactByMembershipId.get(row.approvedByMembershipId)?.email ??
              '',
          }
        : null,
      rejectionReason: row.rejectionReason,
      createdAt: row.createdAt.toISOString(),
    }));

    return { contributions: items };
  }

  // GET /contributions/export — the ledger as a spreadsheet, respecting
  // whatever filter the caller applied (see listContributions) rather than
  // always exporting everything, so "export what I'm looking at" actually
  // means that.
  async exportLedger(
    tenantId: string,
    filters: ContributionListQuery,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const { contributions: items } = await this.listContributions(
      tenantId,
      filters,
    );
    const sheet: ExportSheet = {
      name: 'Contributions',
      columns: [
        { header: 'Member', key: 'member', width: 24 },
        { header: 'Amount (RWF)', key: 'amount' },
        { header: 'Contributed on', key: 'contributedAt' },
        { header: 'Status', key: 'status' },
        { header: 'Recorded by', key: 'recordedBy', width: 24 },
        { header: 'Approved by', key: 'approvedBy', width: 24 },
        { header: 'Rejection reason', key: 'rejectionReason', width: 32 },
        { header: 'Note', key: 'note', width: 32 },
      ],
      rows: items.map((item) => ({
        member: item.member.name,
        amount: item.amount,
        contributedAt: item.contributedAt,
        status: item.status,
        recordedBy: item.recordedBy.name,
        approvedBy: item.approvedBy?.name ?? null,
        rejectionReason: item.rejectionReason,
        note: item.note,
      })),
    };

    const buffer = await this.exportService.buildWorkbook([sheet]);
    const tenantSlug = await this.loadTenantSlug(tenantId);
    const filename = buildExportFilename([
      tenantSlug,
      'contributions',
      filters.status ?? 'all',
      this.currentPeriod(),
    ]);
    return { buffer, filename };
  }

  private currentPeriod(): string {
    return truncateToMonth(new Date());
  }

  private async loadSharePrices(
    executor: Database | Transaction,
    tenantId: string,
  ): Promise<SharePriceRow[]> {
    const rows = await executor
      .select()
      .from(sharePrices)
      .where(eq(sharePrices.tenantId, tenantId));
    return rows
      .map((row) => ({
        id: row.id,
        amount: row.amount,
        effectiveFrom: row.effectiveFrom,
      }))
      .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  }

  private async resolveActiveMembershipId(
    executor: Database | Transaction,
    tenantId: string,
    userId: string,
  ): Promise<string> {
    const [membership] = await executor
      .select({ id: memberships.id })
      .from(memberships)
      .where(
        and(
          eq(memberships.tenantId, tenantId),
          eq(memberships.userId, userId),
          isNull(memberships.removedAt),
        ),
      )
      .limit(1);
    if (!membership) {
      throw new ForbiddenException(
        'No active membership found for this cooperative',
      );
    }
    return membership.id;
  }

  // A membership's name/email don't move once it exists (see users.email
  // and memberships.userId — a membership is never reassigned to a
  // different user), so this doesn't need `removedAt IS NULL` the way an
  // authorization check would: an audit event about a since-removed
  // member should still name them, not go blank.
  private async loadMembershipContact(
    executor: Database | Transaction,
    membershipId: string,
  ): Promise<{ name: string; email: string } | undefined> {
    const [row] = await executor
      .select({ name: users.name, email: users.email })
      .from(memberships)
      .innerJoin(users, eq(memberships.userId, users.id))
      .where(eq(memberships.id, membershipId))
      .limit(1);
    return row;
  }

  // A period's price is pinned by the first allocation ever created for
  // it and reused by every allocation after that — even one from a
  // contribution that's since been rejected — so a period is priced once,
  // consistently, for as long as it exists (see contribution-allocations.ts).
  private async resolveSharePriceIdForPeriod(
    tx: Transaction,
    membershipId: string,
    period: string,
    sharePriceRows: SharePriceRow[],
  ): Promise<string> {
    const [existing] = await tx
      .select({ sharePriceId: contributionAllocations.sharePriceId })
      .from(contributionAllocations)
      .innerJoin(
        contributions,
        eq(contributionAllocations.contributionId, contributions.id),
      )
      .where(
        and(
          eq(contributions.membershipId, membershipId),
          eq(contributionAllocations.period, period),
        ),
      )
      .limit(1);
    if (existing) {
      return existing.sharePriceId;
    }

    const asOf = priceAsOf(sharePriceRows, period);
    if (!asOf) {
      throw new BadRequestException(
        `No share price is effective for ${period}`,
      );
    }
    return asOf.id;
  }

  private async loadPendingContribution(
    tx: Transaction,
    tenantId: string,
    contributionId: string,
  ) {
    const [contribution] = await tx
      .select()
      .from(contributions)
      .where(
        and(
          eq(contributions.id, contributionId),
          eq(contributions.tenantId, tenantId),
        ),
      )
      .limit(1);
    if (!contribution) {
      throw new NotFoundException('No contribution found');
    }
    if (contribution.status !== 'pending') {
      throw new BadRequestException(
        'This contribution has already been decided',
      );
    }
    return contribution;
  }

  // Every active member may record a contribution for themselves — that's
  // the whole point of self-reporting instead of relying on an officer to
  // enter it. Recording for someone else still needs CONTRIBUTIONS_RECORD
  // (or TENANT_ADMIN), same as before this existed.
  private assertCanRecordFor(
    callerMembershipId: string,
    callerPermissions: string[],
    targetMembershipId: string,
  ): void {
    if (targetMembershipId === callerMembershipId) {
      return;
    }
    const canRecordForOthers =
      callerPermissions.includes(PERMISSIONS.CONTRIBUTIONS_RECORD) ||
      callerPermissions.includes(PERMISSIONS.TENANT_ADMIN);
    if (!canRecordForOthers) {
      throw new ForbiddenException(
        'You can only record a contribution for yourself',
      );
    }
  }

  // A removed member's history stays fully visible and explainable (see
  // getMemberSummary/getAnalytics, neither of which filter removedAt) —
  // but nothing new gets recorded against them. Checked up front here so
  // a preview never proposes an allocation that recordContribution would
  // then reject anyway.
  private async assertMembershipActive(
    executor: Database | Transaction,
    tenantId: string,
    membershipId: string,
  ): Promise<void> {
    const [row] = await executor
      .select({ id: memberships.id })
      .from(memberships)
      .where(
        and(
          eq(memberships.id, membershipId),
          eq(memberships.tenantId, tenantId),
          isNull(memberships.removedAt),
        ),
      )
      .limit(1);
    if (!row) {
      throw new NotFoundException('No active member found');
    }
  }

  // Every active membership in the tenant that can currently act as an
  // approver — shared by the self-approval check (which only needs the
  // count) and the pending-approval notification (which needs who they
  // are, to email them).
  private async loadEligibleApproverMemberships(
    executor: Database | Transaction,
    tenantId: string,
  ): Promise<Array<{ id: string; permissions: string[] }>> {
    const rows = await executor
      .select({ id: memberships.id, permissions: memberships.permissions })
      .from(memberships)
      .where(
        and(eq(memberships.tenantId, tenantId), isNull(memberships.removedAt)),
      );
    return rows.filter(
      (row) =>
        row.permissions.includes(PERMISSIONS.CONTRIBUTIONS_APPROVE) ||
        row.permissions.includes(PERMISSIONS.TENANT_ADMIN),
    );
  }

  // Recorder ≠ approver, unless the recorder is the only membership in the
  // tenant currently eligible to approve at all — in which case full
  // transparency (every member can see every contribution) is the
  // accountability mechanism instead of a second approver.
  private async assertCanApprove(
    tx: Transaction,
    tenantId: string,
    approverMembershipId: string,
    recordedByMembershipId: string,
  ): Promise<void> {
    if (approverMembershipId !== recordedByMembershipId) {
      return;
    }

    const eligibleApprovers = await this.loadEligibleApproverMemberships(
      tx,
      tenantId,
    );

    if (eligibleApprovers.length > 1) {
      throw new ForbiddenException(
        'Someone else needs to approve this contribution',
      );
    }
  }

  // The latest period any approved allocation names, or `fallback` if
  // there are none yet — used to make sure a member who has already
  // prepaid ahead is recognized as such, rather than the caller assuming
  // nothing exists past the current month.
  private async loadLatestTouchedPeriod(
    membershipId: string,
    fallback: string,
  ): Promise<string> {
    const rows = await this.db
      .select({ period: contributionAllocations.period })
      .from(contributionAllocations)
      .innerJoin(
        contributions,
        eq(contributionAllocations.contributionId, contributions.id),
      )
      .where(
        and(
          eq(contributions.membershipId, membershipId),
          eq(contributions.status, 'approved'),
        ),
      );
    return rows.reduce(
      (latest, row) => (row.period > latest ? row.period : latest),
      fallback,
    );
  }

  // Every period from the later of (membership joined, cooperative's first
  // share price) through `throughPeriod` inclusive, with each period's due
  // amount, amount actually paid (approved allocations only — a pending
  // one might still be rejected, so it doesn't reduce what shows as
  // outstanding), and computed status.
  private async loadPeriodsThrough(
    tenantId: string,
    membershipId: string,
    throughPeriod: string,
    sharePriceRows: SharePriceRow[],
  ): Promise<ComputedPeriod[]> {
    const [membership] = await this.db
      .select({ createdAt: memberships.createdAt })
      .from(memberships)
      .where(
        and(
          eq(memberships.id, membershipId),
          eq(memberships.tenantId, tenantId),
        ),
      )
      .limit(1);
    if (!membership) {
      throw new NotFoundException('No active member found');
    }

    const membershipStartPeriod = truncateToMonth(membership.createdAt);
    const firstPricePeriod = truncateToMonth(
      new Date(sharePriceRows[0].effectiveFrom),
    );
    const startPeriod =
      membershipStartPeriod > firstPricePeriod
        ? membershipStartPeriod
        : firstPricePeriod;

    const allocationRows = await this.db
      .select({
        period: contributionAllocations.period,
        amount: contributionAllocations.amount,
        sharePriceId: contributionAllocations.sharePriceId,
      })
      .from(contributionAllocations)
      .innerJoin(
        contributions,
        eq(contributionAllocations.contributionId, contributions.id),
      )
      .where(
        and(
          eq(contributions.membershipId, membershipId),
          eq(contributions.status, 'approved'),
        ),
      );

    const paidByPeriod = new Map<string, number>();
    const priceIdByPeriod = new Map<string, string>();
    for (const row of allocationRows) {
      paidByPeriod.set(
        row.period,
        (paidByPeriod.get(row.period) ?? 0) + row.amount,
      );
      if (!priceIdByPeriod.has(row.period)) {
        priceIdByPeriod.set(row.period, row.sharePriceId);
      }
    }

    const priceById = new Map(sharePriceRows.map((row) => [row.id, row]));
    const current = this.currentPeriod();
    const periods: ComputedPeriod[] = [];
    let cursor = startPeriod;
    while (cursor <= throughPeriod) {
      const paidAmount = paidByPeriod.get(cursor) ?? 0;
      const pinnedPriceId = priceIdByPeriod.get(cursor);
      const price = pinnedPriceId
        ? priceById.get(pinnedPriceId)
        : priceAsOf(sharePriceRows, cursor);
      if (!price) {
        throw new BadRequestException(
          `No share price is effective for ${cursor}`,
        );
      }
      periods.push({
        period: cursor,
        dueAmount: price.amount,
        paidAmount,
        status: computeStatus(cursor, current, price.amount, paidAmount),
      });
      cursor = nextPeriod(cursor);
    }

    return periods;
  }

  // The waterfall's seed list: every period through the later of (now,
  // whatever the member has actually already touched — including a
  // prepaid future month), so computeWaterfallAllocations always has a
  // correct starting point and never mistakes an already-satisfied future
  // period for untouched territory.
  private async loadOutstandingPeriods(
    tenantId: string,
    membershipId: string,
  ): Promise<{ periods: ComputedPeriod[]; sharePriceRows: SharePriceRow[] }> {
    const sharePriceRows = await this.loadSharePrices(this.db, tenantId);
    if (sharePriceRows.length === 0) {
      throw new BadRequestException(
        'Contributions have not been set up for this cooperative yet',
      );
    }

    const current = this.currentPeriod();
    const latestTouched = await this.loadLatestTouchedPeriod(
      membershipId,
      current,
    );
    const periods = await this.loadPeriodsThrough(
      tenantId,
      membershipId,
      latestTouched,
      sharePriceRows,
    );

    return { periods, sharePriceRows };
  }

  private async sumApprovedContributions(
    membershipId: string,
  ): Promise<number> {
    const rows = await this.db
      .select({ amount: contributions.amount })
      .from(contributions)
      .where(
        and(
          eq(contributions.membershipId, membershipId),
          eq(contributions.status, 'approved'),
        ),
      );
    return rows.reduce((total, row) => total + row.amount, 0);
  }

  private async loadMembershipContacts(
    tenantId: string,
  ): Promise<Map<string, { name: string; email: string }>> {
    const rows = await this.db
      .select({
        membershipId: memberships.id,
        name: users.name,
        email: users.email,
      })
      .from(memberships)
      .innerJoin(users, eq(memberships.userId, users.id))
      .where(eq(memberships.tenantId, tenantId));
    return new Map(
      rows.map((row) => [
        row.membershipId,
        { name: row.name, email: row.email },
      ]),
    );
  }

  private async loadPeriodLabel(contributionId: string): Promise<string> {
    const allocations = await this.db
      .select({ period: contributionAllocations.period })
      .from(contributionAllocations)
      .where(eq(contributionAllocations.contributionId, contributionId));
    return allocations.map((row) => formatPeriodLabel(row.period)).join(', ');
  }

  private async sendApprovedEmail(
    tenantId: string,
    contribution: typeof contributions.$inferSelect,
  ): Promise<void> {
    const [member] = await this.db
      .select({ name: users.name, email: users.email })
      .from(memberships)
      .innerJoin(users, eq(memberships.userId, users.id))
      .where(eq(memberships.id, contribution.membershipId))
      .limit(1);
    const [tenant] = await this.db
      .select({ name: tenants.name })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);
    if (!member || !tenant) {
      return;
    }

    const periodLabel = await this.loadPeriodLabel(contribution.id);

    const { html, text } = await renderEmail(
      ContributionApprovedEmail({
        memberName: member.name,
        cooperativeName: tenant.name,
        periodLabel: periodLabel || 'your contribution',
        amount: contribution.amount,
        statusUrl: `${env.WEB_ORIGIN}/contributions`,
      }),
    );
    await this.mailer
      .send({
        to: member.email,
        subject: `Your contribution to ${tenant.name} has been approved`,
        html,
        text,
      })
      .catch((error: unknown) => {
        this.logger.error(
          `Failed to send contribution-approved email for contribution ${contribution.id}`,
          error,
        );
      });
  }

  // Whoever can approve this gets pinged the moment it's pending — the
  // point of letting anyone self-report a contribution is that an
  // approver only has to react to a notification (check the payment
  // actually arrived, click approve) rather than remember to go looking
  // for what's outstanding. The recorder themselves is never on this
  // list — they already know what they just did — so a solo eligible
  // approver recording their own contribution sends nobody anything.
  private async sendPendingApprovalEmail(
    tenantId: string,
    contribution: typeof contributions.$inferSelect,
  ): Promise<void> {
    const eligibleApprovers = (
      await this.loadEligibleApproverMemberships(this.db, tenantId)
    ).filter((row) => row.id !== contribution.recordedByMembershipId);
    if (eligibleApprovers.length === 0) {
      return;
    }

    const contactByMembershipId = await this.loadMembershipContacts(tenantId);
    const member = contactByMembershipId.get(contribution.membershipId);
    const recorder = contactByMembershipId.get(
      contribution.recordedByMembershipId,
    );
    const [tenant] = await this.db
      .select({ name: tenants.name })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);
    if (!member || !recorder || !tenant) {
      return;
    }

    const periodLabel = await this.loadPeriodLabel(contribution.id);
    const approveUrl = `${env.WEB_ORIGIN}/contributions`;

    await Promise.all(
      eligibleApprovers.map(async (approver) => {
        const approverContact = contactByMembershipId.get(approver.id);
        if (!approverContact) {
          return;
        }
        const { html, text } = await renderEmail(
          ContributionPendingApprovalEmail({
            approverName: approverContact.name,
            recorderName: recorder.name,
            memberName: member.name,
            cooperativeName: tenant.name,
            periodLabel: periodLabel || 'a contribution',
            amount: contribution.amount,
            approveUrl,
          }),
        );
        await this.mailer
          .send({
            to: approverContact.email,
            subject: `A contribution to ${tenant.name} needs your approval`,
            html,
            text,
          })
          .catch((error: unknown) => {
            this.logger.error(
              `Failed to send pending-approval email for contribution ${contribution.id} to ${approverContact.email}`,
              error,
            );
          });
      }),
    );
  }
}
