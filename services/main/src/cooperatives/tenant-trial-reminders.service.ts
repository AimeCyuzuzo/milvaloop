import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { and, eq, isNull, schema, type Database } from '@milvaloop/db';
import {
  PremiumTrialEndingEmail,
  renderEmail,
  type Mailer,
} from '@milvaloop/email';
import { getTenantAccessState, PERMISSIONS } from '@milvaloop/types';

import { env } from '../config/env';
import { DATABASE_CONNECTION } from '../db/db.module';
import { MAILER } from '../email/mailer.module';

const { memberships, tenants, tenantTrialReminders, users } = schema;

// Which days-remaining values fire a reminder — not every day of the
// 21-day warning window, just enough touchpoints to escalate without
// becoming noise (see tenant-access.ts's TRIAL_WARNING_WINDOW_DAYS, the
// same window the in-app banner uses).
const REMINDER_THRESHOLDS = [21, 14, 7, 3, 1];

const DATE_LABEL_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

@Injectable()
export class TenantTrialReminderService {
  private readonly logger = new Logger(TenantTrialReminderService.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    @Inject(MAILER) private readonly mailer: Mailer,
  ) {}

  // Runs in-process on whichever instance is up — same single-instance
  // caveat as ContributionReminderService (see docs/DEPLOYMENT.md).
  @Cron('0 8 * * *')
  async sendTrialEndingReminders(): Promise<void> {
    const premiumTenants = await this.db
      .select({
        id: tenants.id,
        name: tenants.name,
        premiumExpiresAt: tenants.premiumExpiresAt,
      })
      .from(tenants)
      .where(eq(tenants.plan, 'premium'));

    for (const tenant of premiumTenants) {
      await this.remindTenant(tenant).catch((error: unknown) => {
        this.logger.error(
          `Failed to process trial-ending reminders for tenant ${tenant.id}`,
          error,
        );
      });
    }
  }

  private async remindTenant(tenant: {
    id: string;
    name: string;
    premiumExpiresAt: Date | null;
  }): Promise<void> {
    const accessState = getTenantAccessState({
      plan: 'premium',
      premiumExpiresAt: tenant.premiumExpiresAt?.toISOString() ?? null,
    });
    if (accessState.status !== 'trial_ending') {
      return;
    }
    if (!REMINDER_THRESHOLDS.includes(accessState.daysRemaining)) {
      return;
    }

    const alreadySent = await this.db
      .select({ id: tenantTrialReminders.id })
      .from(tenantTrialReminders)
      .where(
        and(
          eq(tenantTrialReminders.tenantId, tenant.id),
          eq(tenantTrialReminders.daysRemaining, accessState.daysRemaining),
        ),
      )
      .limit(1);
    if (alreadySent.length > 0) {
      return;
    }

    const members = await this.db
      .select({ email: users.email, permissions: memberships.permissions })
      .from(memberships)
      .innerJoin(users, eq(memberships.userId, users.id))
      .where(
        and(eq(memberships.tenantId, tenant.id), isNull(memberships.removedAt)),
      );
    const adminEmails = members
      .filter((row) => row.permissions.includes(PERMISSIONS.TENANT_ADMIN))
      .map((row) => row.email);

    const { html, text } = await renderEmail(
      PremiumTrialEndingEmail({
        cooperativeName: tenant.name,
        daysRemaining: accessState.daysRemaining,
        expiresOnLabel: tenant.premiumExpiresAt
          ? DATE_LABEL_FORMATTER.format(tenant.premiumExpiresAt)
          : '',
        accountUrl: `${env.WEB_ORIGIN}/account`,
      }),
    );

    for (const email of adminEmails) {
      try {
        await this.mailer.send({
          to: email,
          subject: `${tenant.name}'s Premium access ends in ${accessState.daysRemaining} days`,
          html,
          text,
        });
      } catch (error) {
        this.logger.error(
          `Failed to send trial-ending reminder to ${email}`,
          error,
        );
      }
    }

    await this.db.insert(tenantTrialReminders).values({
      tenantId: tenant.id,
      daysRemaining: accessState.daysRemaining,
    });
  }
}
