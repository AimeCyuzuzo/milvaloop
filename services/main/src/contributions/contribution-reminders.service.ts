import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { and, eq, isNull, schema, type Database } from '@milvaloop/db';
import {
  ContributionReminderEmail,
  renderEmail,
  type Mailer,
} from '@milvaloop/email';
import type { PeriodStatus } from '@milvaloop/types';

import { env } from '../config/env';
import { DATABASE_CONNECTION } from '../db/db.module';
import { MAILER } from '../email/mailer.module';
import { formatPeriodLabel, truncateToMonth } from './contributions-dates';
import { ContributionsService } from './contributions.service';

const { contributionReminders, memberships, sharePrices, tenants, users } =
  schema;

// A quiet nudge partway through the month a period is due, and one
// "overdue" notice after it closes unsatisfied — never more than that per
// period per trigger (see contribution_reminders' unique constraint) and
// never anything beyond email (§5.7 of PLATFORM_BRAINSTORMING.md: an
// automated reminder in a small community is a social instrument, not a
// neutral notification).
const DUE_SOON_DAY_OF_MONTH = 15;
const OVERDUE_GRACE_DAYS = 7;

function dueSoonThreshold(period: string): Date {
  const [year, month] = period.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, DUE_SOON_DAY_OF_MONTH));
}

// `month` here is the period's own 1-indexed month number, which is
// already the 0-indexed *next* month for Date.UTC — the same trick
// contributions-waterfall.ts's nextPeriod uses.
function overdueThreshold(period: string): Date {
  const [year, month] = period.split('-').map(Number);
  return new Date(Date.UTC(year, month, OVERDUE_GRACE_DAYS));
}

interface ReminderTrigger {
  period: string;
  kind: 'due_soon' | 'overdue';
}

@Injectable()
export class ContributionReminderService {
  private readonly logger = new Logger(ContributionReminderService.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    @Inject(MAILER) private readonly mailer: Mailer,
    private readonly contributionsService: ContributionsService,
  ) {}

  // Runs in-process on whichever instance is up — fine at today's
  // single-instance scale (see docs/DEPLOYMENT.md). Running more than one
  // instance later would need this pinned to one designated instance or
  // guarded by a distributed lock, or every instance would send the same
  // reminder the same day.
  @Cron('0 8 * * *')
  async sendDailyReminders(): Promise<void> {
    const tenantRows = await this.db
      .selectDistinct({ tenantId: sharePrices.tenantId })
      .from(sharePrices);
    for (const { tenantId } of tenantRows) {
      await this.remindTenant(tenantId);
    }
  }

  private async remindTenant(tenantId: string): Promise<void> {
    const remindableMembers = await this.db
      .select({ id: memberships.id })
      .from(memberships)
      .where(
        and(
          eq(memberships.tenantId, tenantId),
          isNull(memberships.removedAt),
          isNull(memberships.remindersPausedAt),
        ),
      );

    for (const membership of remindableMembers) {
      await this.remindMember(tenantId, membership.id).catch(
        (error: unknown) => {
          this.logger.error(
            `Failed to process contribution reminders for membership ${membership.id}`,
            error,
          );
        },
      );
    }
  }

  private async remindMember(
    tenantId: string,
    membershipId: string,
  ): Promise<void> {
    const summary = await this.contributionsService.getMemberSummary(
      tenantId,
      membershipId,
    );
    const outstanding = summary.periods.filter(
      (period) =>
        period.status === 'due' ||
        period.status === 'overdue' ||
        period.status === 'partial',
    );
    if (outstanding.length === 0) {
      return;
    }

    const currentPeriod = truncateToMonth(new Date());
    const today = new Date();
    const candidates: ReminderTrigger[] = [];
    for (const period of outstanding) {
      if (
        period.status === 'overdue' &&
        today >= overdueThreshold(period.period)
      ) {
        candidates.push({ period: period.period, kind: 'overdue' });
      } else if (
        period.period === currentPeriod &&
        today >= dueSoonThreshold(period.period)
      ) {
        candidates.push({ period: period.period, kind: 'due_soon' });
      }
    }
    if (candidates.length === 0) {
      return;
    }

    const alreadySent = await this.loadAlreadySentKeys(membershipId);
    const newTriggers = candidates.filter(
      (candidate) => !alreadySent.has(`${candidate.period}:${candidate.kind}`),
    );
    if (newTriggers.length === 0) {
      return;
    }

    const sent = await this.sendReminderEmail(
      tenantId,
      membershipId,
      outstanding,
      newTriggers,
    );
    if (!sent) {
      return;
    }

    await this.db.insert(contributionReminders).values(
      newTriggers.map((trigger) => ({
        tenantId,
        membershipId,
        period: trigger.period,
        kind: trigger.kind,
      })),
    );
  }

  private async loadAlreadySentKeys(
    membershipId: string,
  ): Promise<Set<string>> {
    const rows = await this.db
      .select({
        period: contributionReminders.period,
        kind: contributionReminders.kind,
      })
      .from(contributionReminders)
      .where(eq(contributionReminders.membershipId, membershipId));
    return new Set(rows.map((row) => `${row.period}:${row.kind}`));
  }

  // The email always reflects the member's full current outstanding
  // picture, not just the periods that newly crossed a trigger this run —
  // someone already three months behind who crosses a fourth sees all four.
  private async sendReminderEmail(
    tenantId: string,
    membershipId: string,
    outstanding: PeriodStatus[],
    triggers: ReminderTrigger[],
  ): Promise<boolean> {
    const [member] = await this.db
      .select({ name: users.name, email: users.email })
      .from(memberships)
      .innerJoin(users, eq(memberships.userId, users.id))
      .where(eq(memberships.id, membershipId))
      .limit(1);
    const [tenant] = await this.db
      .select({ name: tenants.name })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);
    if (!member || !tenant) {
      return false;
    }

    const reminderKind: 'due_soon' | 'overdue' = triggers.some(
      (trigger) => trigger.kind === 'overdue',
    )
      ? 'overdue'
      : 'due_soon';
    const outstandingForEmail = outstanding.map((period) => ({
      periodLabel: formatPeriodLabel(period.period),
      dueAmount: period.dueAmount,
      paidAmount: period.paidAmount,
    }));
    const totalRemaining = outstanding.reduce(
      (total, period) => total + (period.dueAmount - period.paidAmount),
      0,
    );

    const { html, text } = await renderEmail(
      ContributionReminderEmail({
        memberName: member.name,
        cooperativeName: tenant.name,
        reminderKind,
        outstandingPeriods: outstandingForEmail,
        totalRemaining,
        statusUrl: `${env.WEB_ORIGIN}/contributions`,
      }),
    );

    try {
      await this.mailer.send({
        to: member.email,
        subject: `A contribution reminder from ${tenant.name}`,
        html,
        text,
      });
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send contribution reminder to membership ${membershipId}`,
        error,
      );
      return false;
    }
  }
}
