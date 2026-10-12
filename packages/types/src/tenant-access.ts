import { z } from 'zod';

export const tenantPlanSchema = z.enum(['free', 'premium']);
export type TenantPlan = z.infer<typeof tenantPlanSchema>;

// A cooperative on the Free plan never expires; this cap is the only limit
// it has (see MembersService's invite/addPlaceholderMember).
export const FREE_PLAN_MEMBER_CAP = 10;

// How many days before Premium access actually lapses the warning banner
// and reminder emails start — three weeks, which is also the whole width
// the banner's gray-to-red escalation spans.
export const TRIAL_WARNING_WINDOW_DAYS = 21;

// How long a tenant can sit expired before it's eligible for deletion —
// read-only lockdown starts immediately on expiry (see getTenantAccessState
// below), this is the further grace period after that.
export const DELETION_GRACE_DAYS = 30;

// Premium's own pricing tiers (see the pricing page's hand-written FAQ copy,
// which these mirror but aren't derived from). There's no payment gateway —
// plan changes are a manual operator action (see set-tenant-plan.ts) — so
// this is never charged automatically; it's the number an operator checks a
// tenant's member count against before invoicing (see tenant:list).
export const PREMIUM_BASE_MEMBER_CAP = 30;
export const PREMIUM_BASE_MONTHLY_FEE_RWF = 12_000;
export const PREMIUM_TIER_SIZE = 10;
export const PREMIUM_TIER_FEE_RWF = 5_000;

export function computePremiumMonthlyFeeRwf(memberCount: number): number {
  if (memberCount <= PREMIUM_BASE_MEMBER_CAP) {
    return PREMIUM_BASE_MONTHLY_FEE_RWF;
  }
  const extraTiers = Math.ceil(
    (memberCount - PREMIUM_BASE_MEMBER_CAP) / PREMIUM_TIER_SIZE,
  );
  return PREMIUM_BASE_MONTHLY_FEE_RWF + extraTiers * PREMIUM_TIER_FEE_RWF;
}

export type TenantAccessState =
  | { status: 'active' }
  | { status: 'trial_ending'; daysRemaining: number; severity: 'low' | 'medium' | 'high' }
  | { status: 'locked'; daysSinceExpiry: number; deletionEligible: boolean };

// The one place a tenant's plan and premiumExpiresAt turn into an actual
// access decision — used identically by the backend (blocking writes and
// non-admin logins) and the frontend (the escalating trial banner), so the
// two can never silently disagree about what state a tenant is in.
export function getTenantAccessState(
  tenant: { plan: TenantPlan; premiumExpiresAt: string | null },
  now: Date = new Date(),
): TenantAccessState {
  if (tenant.plan === 'free' || !tenant.premiumExpiresAt) {
    return { status: 'active' };
  }

  const expiresAt = new Date(tenant.premiumExpiresAt);
  const msRemaining = expiresAt.getTime() - now.getTime();
  const daysRemaining = Math.ceil(msRemaining / (24 * 60 * 60 * 1000));

  if (daysRemaining <= 0) {
    const daysSinceExpiry = -daysRemaining;
    return {
      status: 'locked',
      daysSinceExpiry,
      deletionEligible: daysSinceExpiry >= DELETION_GRACE_DAYS,
    };
  }

  if (daysRemaining > TRIAL_WARNING_WINDOW_DAYS) {
    return { status: 'active' };
  }

  const severity = daysRemaining <= 7 ? 'high' : daysRemaining <= 14 ? 'medium' : 'low';
  return { status: 'trial_ending', daysRemaining, severity };
}
