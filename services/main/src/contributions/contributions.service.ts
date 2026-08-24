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
  ContributionRecordedEmail,
  renderEmail,
  type Mailer,
} from '@milvaloop/email';
import {
  PERMISSIONS,
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
    input: PreviewAllocationInput,
  ): Promise<PreviewAllocationResponse> {
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
    return {
      lines: lines.map((line) => {
        const dueAmount =
          priceAsOf(sharePriceRows, line.period)?.amount ?? latestPrice.amount;
        return {
          period: line.period,
          amount: line.amount,
          sharePriceAmount: dueAmount,
          resultingStatus: line.amount >= dueAmount ? 'satisfied' : 'partial',
        };
      }),
    };
  }

  async recordContribution(
    tenantId: string,
    recordedByUserId: string,
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

    await this.db.transaction(async (tx) => {
      const recordedByMembershipId = await this.resolveActiveMembershipId(
        tx,
        tenantId,
        recordedByUserId,
      );

      const [member] = await tx
        .select({ id: memberships.id })
        .from(memberships)
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
          amount: input.amount,
          allocations: input.allocations,
        },
      });
    });
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

      await this.auditLog.record(tx, {
        tenantId,
        actorUserId: approverUserId,
        action: 'contribution.approved',
        entityType: 'contribution',
        entityId: contributionId,
        metadata: {},
      });

      return contribution;
    });

    await this.sendRecordedEmail(tenantId, approved);
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

      await this.auditLog.record(tx, {
        tenantId,
        actorUserId: approverUserId,
        action: 'contribution.rejected',
        entityType: 'contribution',
        entityId: contributionId,
        metadata: { reason },
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

    const totalShares = periods.reduce(
      (total, period) =>
        total + Math.floor(period.paidAmount / period.dueAmount),
      0,
    );
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
        memberEmail: users.email,
        recordedByMembershipId: contributions.recordedByMembershipId,
        approvedByMembershipId: contributions.approvedByMembershipId,
      })
      .from(contributions)
      .innerJoin(memberships, eq(contributions.membershipId, memberships.id))
      .innerJoin(users, eq(memberships.userId, users.id))
      .where(and(...conditions));

    const actorEmailByMembershipId = await this.loadMembershipEmails(tenantId);

    const items: ContributionListItem[] = rows.map((row) => ({
      id: row.id,
      member: { membershipId: row.memberMembershipId, email: row.memberEmail },
      amount: row.amount,
      contributedAt: row.contributedAt.toISOString().slice(0, 10),
      status: row.status as ContributionListItem['status'],
      note: row.note,
      recordedBy: {
        membershipId: row.recordedByMembershipId,
        email: actorEmailByMembershipId.get(row.recordedByMembershipId) ?? '',
      },
      approvedBy: row.approvedByMembershipId
        ? {
            membershipId: row.approvedByMembershipId,
            email:
              actorEmailByMembershipId.get(row.approvedByMembershipId) ?? '',
          }
        : null,
      rejectionReason: row.rejectionReason,
      createdAt: row.createdAt.toISOString(),
    }));

    return { contributions: items };
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
    tx: Transaction,
    tenantId: string,
    userId: string,
  ): Promise<string> {
    const [membership] = await tx
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

    const rows = await tx
      .select({ permissions: memberships.permissions })
      .from(memberships)
      .where(
        and(eq(memberships.tenantId, tenantId), isNull(memberships.removedAt)),
      );
    const eligibleApprovers = rows.filter(
      (row) =>
        row.permissions.includes(PERMISSIONS.CONTRIBUTIONS_APPROVE) ||
        row.permissions.includes(PERMISSIONS.TENANT_ADMIN),
    ).length;

    if (eligibleApprovers > 1) {
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

  private async loadMembershipEmails(
    tenantId: string,
  ): Promise<Map<string, string>> {
    const rows = await this.db
      .select({ membershipId: memberships.id, email: users.email })
      .from(memberships)
      .innerJoin(users, eq(memberships.userId, users.id))
      .where(eq(memberships.tenantId, tenantId));
    return new Map(rows.map((row) => [row.membershipId, row.email]));
  }

  private async sendRecordedEmail(
    tenantId: string,
    contribution: typeof contributions.$inferSelect,
  ): Promise<void> {
    const [member] = await this.db
      .select({ email: users.email })
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

    const allocations = await this.db
      .select({ period: contributionAllocations.period })
      .from(contributionAllocations)
      .where(eq(contributionAllocations.contributionId, contribution.id));
    const periodLabel = allocations
      .map((row) => formatPeriodLabel(row.period))
      .join(', ');

    const { html, text } = await renderEmail(
      ContributionRecordedEmail({
        memberName: member.email,
        cooperativeName: tenant.name,
        periodLabel: periodLabel || 'your contribution',
        amount: contribution.amount,
        statusUrl: `${env.WEB_ORIGIN}/contributions`,
      }),
    );
    await this.mailer
      .send({
        to: member.email,
        subject: `Your contribution to ${tenant.name} has been recorded`,
        html,
        text,
      })
      .catch((error: unknown) => {
        this.logger.error(
          `Failed to send contribution-recorded email for contribution ${contribution.id}`,
          error,
        );
      });
  }
}
