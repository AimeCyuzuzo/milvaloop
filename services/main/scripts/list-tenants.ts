// Run with: pnpm --filter @milvaloop/main tenant:list
//
// Read-only — every tenant's plan, access state, member count, and (for
// Premium) the monthly fee that member count should currently be billed
// at, all computed the same way the app itself does (see
// getTenantAccessState and computePremiumMonthlyFeeRwf). This is the one
// place to check which tenants are approaching expiry, locked, past the
// deletion grace period, or have grown into a higher Premium pricing tier
// (see set-tenant-plan.ts for acting on any of these; deletion itself is
// never automatic — see tenants.ts).
import {
  and,
  asc,
  createDb,
  eq,
  isNull,
  schema,
  type Database,
} from '@milvaloop/db';
import {
  computePremiumMonthlyFeeRwf,
  getTenantAccessState,
} from '@milvaloop/types';

import { env } from '../src/config/env';

const { tenants, memberships, membershipInvites } = schema;

// Mirrors MembersService.assertUnderFreePlanCap's own counting: active
// memberships plus still-pending invites, the same "occupied slots" the app
// enforces the Free-plan cap against and bills Premium's per-10 tiers on.
async function occupiedSlots(db: Database, tenantId: string): Promise<number> {
  const activeRows = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(
      and(eq(memberships.tenantId, tenantId), isNull(memberships.removedAt)),
    );
  const pendingRows = await db
    .select({ id: membershipInvites.id })
    .from(membershipInvites)
    .where(
      and(
        eq(membershipInvites.tenantId, tenantId),
        isNull(membershipInvites.consumedAt),
      ),
    );
  return activeRows.length + pendingRows.length;
}

async function main() {
  const db = createDb(env.DATABASE_URL);
  const rows = await db.select().from(tenants).orderBy(asc(tenants.name));

  for (const tenant of rows) {
    const state = getTenantAccessState({
      plan: tenant.plan,
      premiumExpiresAt: tenant.premiumExpiresAt?.toISOString() ?? null,
    });
    const statusLabel =
      state.status === 'active'
        ? 'active'
        : state.status === 'trial_ending'
          ? `ends in ${state.daysRemaining}d (${state.severity})`
          : `locked ${state.daysSinceExpiry}d ago${state.deletionEligible ? ' — DELETION ELIGIBLE' : ''}`;
    const memberCount = await occupiedSlots(db, tenant.id);
    const billingLabel =
      tenant.plan === 'premium'
        ? ` — ${computePremiumMonthlyFeeRwf(memberCount).toLocaleString()} RWF/month`
        : '';
    console.log(
      `${tenant.name} (${tenant.slug}) — ${tenant.plan} — ${statusLabel} — ${memberCount} members${billingLabel}`,
    );
  }
}

main()
  .then(() => process.exit())
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
