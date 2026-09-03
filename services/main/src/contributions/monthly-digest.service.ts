import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { and, eq, gte, isNull, lt, schema, type Database } from '@milvaloop/db';
import { MonthlyDigestEmail, renderEmail, type Mailer } from '@milvaloop/email';

import { AuditLogService } from '../audit/audit-log.service';
import { env } from '../config/env';
import { DATABASE_CONNECTION } from '../db/db.module';
import { MAILER } from '../email/mailer.module';
import { formatPeriodLabel, truncateToMonth } from './contributions-dates';
import { nextPeriod, previousPeriod } from './contributions-waterfall';
import { ContributionsService } from './contributions.service';

const { memberships, monthlyDigests, sharePrices, tenants, users } = schema;

// How many days into the new month to wait before summarizing the one
// that just closed — a contribution paid on the last day of the month
// still needs time to be approved, so reporting on day 1 would risk
// describing a period as worse than it actually ended up.
const DIGEST_DAY_OF_MONTH = 3;

@Injectable()
export class MonthlyDigestService {
  private readonly logger = new Logger(MonthlyDigestService.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    @Inject(MAILER) private readonly mailer: Mailer,
    private readonly contributionsService: ContributionsService,
    private readonly auditLog: AuditLogService,
  ) {}

  // Runs in-process on whichever instance is up — same single-instance
  // caveat as ContributionReminderService (see docs/DEPLOYMENT.md).
  @Cron(`0 8 ${DIGEST_DAY_OF_MONTH} * *`)
  async sendMonthlyDigests(): Promise<void> {
    const period = previousPeriod(truncateToMonth(new Date()));
    const tenantRows = await this.db
      .selectDistinct({ tenantId: sharePrices.tenantId })
      .from(sharePrices);
    for (const { tenantId } of tenantRows) {
      await this.sendDigestForTenant(tenantId, period).catch(
        (error: unknown) => {
          this.logger.error(
            `Failed to send monthly digest for tenant ${tenantId}`,
            error,
          );
        },
      );
    }
  }

  private async sendDigestForTenant(
    tenantId: string,
    period: string,
  ): Promise<void> {
    const alreadySent = await this.db
      .select({ id: monthlyDigests.id })
      .from(monthlyDigests)
      .where(
        and(
          eq(monthlyDigests.tenantId, tenantId),
          eq(monthlyDigests.period, period),
        ),
      )
      .limit(1);
    if (alreadySent.length > 0) {
      return;
    }

    const [tenant] = await this.db
      .select({ name: tenants.name })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);
    if (!tenant) {
      return;
    }

    // Guaranteed to have at least one price row (we're iterating tenantIds
    // straight off the share_prices table), so this only fails for a real
    // error — left to propagate to the per-tenant catch in
    // sendMonthlyDigests, same as ContributionReminderService's own
    // per-tenant error isolation.
    const analytics = await this.contributionsService.getAnalytics(tenantId);
    // A tenant whose price history doesn't reach back to `period` yet
    // (set up after that month already closed) simply has no row for it —
    // nothing went on there yet that this digest could report.
    const periodCounts = analytics.periods.find(
      (candidate) => candidate.period === period,
    );
    if (!periodCounts) {
      await this.markSent(tenantId, period, 0);
      return;
    }

    const totalContributed = analytics.members.reduce((total, member) => {
      const entry = member.periods.find(
        (candidate) => candidate.period === period,
      );
      return total + (entry?.paidAmount ?? 0);
    }, 0);

    const periodEnd = nextPeriod(period);
    const newMemberRows = await this.db
      .select({ name: users.name })
      .from(memberships)
      .innerJoin(users, eq(memberships.userId, users.id))
      .where(
        and(
          eq(memberships.tenantId, tenantId),
          isNull(memberships.removedAt),
          gte(memberships.memberSince, period),
          lt(memberships.memberSince, periodEnd),
        ),
      );

    const [priceChangeRow] = await this.db
      .select({ amount: sharePrices.amount })
      .from(sharePrices)
      .where(
        and(
          eq(sharePrices.tenantId, tenantId),
          gte(sharePrices.effectiveFrom, period),
          lt(sharePrices.effectiveFrom, periodEnd),
        ),
      )
      .limit(1);

    const recipientRows = await this.db
      .select({ email: users.email })
      .from(memberships)
      .innerJoin(users, eq(memberships.userId, users.id))
      .where(
        and(
          eq(memberships.tenantId, tenantId),
          isNull(memberships.removedAt),
          isNull(memberships.digestPausedAt),
        ),
      );

    const { html, text } = await renderEmail(
      MonthlyDigestEmail({
        cooperativeName: tenant.name,
        periodLabel: formatPeriodLabel(period),
        totalContributed,
        satisfied: periodCounts.satisfied,
        partial: periodCounts.partial,
        due: periodCounts.due,
        overdue: periodCounts.overdue,
        newMemberNames: newMemberRows.map((row) => row.name),
        priceChange: priceChangeRow ? { amount: priceChangeRow.amount } : null,
        statusUrl: `${env.WEB_ORIGIN}/contributions/analytics`,
      }),
    );

    let sentCount = 0;
    for (const recipient of recipientRows) {
      try {
        await this.mailer.send({
          to: recipient.email,
          subject: `${tenant.name}'s summary for ${formatPeriodLabel(period)}`,
          html,
          text,
        });
        sentCount += 1;
      } catch (error) {
        this.logger.error(
          `Failed to send monthly digest to ${recipient.email}`,
          error,
        );
      }
    }

    await this.markSent(tenantId, period, sentCount);
  }

  // Recorded once attempted, not once every recipient succeeds — a
  // permanently bad address won't be fixed by retrying the whole tenant
  // next month, and the alternative (never marking the tenant as sent
  // because of one bad address) would resend to everyone else too.
  private async markSent(
    tenantId: string,
    period: string,
    recipientCount: number,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.insert(monthlyDigests).values({ tenantId, period });
      await this.auditLog.record(tx, {
        tenantId,
        actorUserId: null,
        action: 'digest.sent',
        entityType: 'tenant',
        entityId: tenantId,
        metadata: { period, recipientCount },
      });
    });
  }
}
